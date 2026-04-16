from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest


PY_DIR = Path(__file__).resolve().parents[1] / "src-tauri" / "python"
if str(PY_DIR) not in sys.path:
    sys.path.insert(0, str(PY_DIR))

import backend
import Parser_2 as analyzer


def test_emit_serializes_numpy_values(monkeypatch):
    buffer = io.StringIO()
    monkeypatch.setattr(backend.sys, "stdout", buffer)

    backend.emit({
        "count": np.int64(3),
        "values": np.array([1, 2, 3]),
        "ratio": np.float32(1.5),
    })

    payload = json.loads(buffer.getvalue())
    assert payload["count"] == 3
    assert payload["values"] == [1, 2, 3]
    assert payload["ratio"] == pytest.approx(1.5)


def test_scan_headers_parse_npd_and_match_track(tmp_path):
    npd_path = tmp_path / "sample.npd"
    npd_path.write_text(
        "\n".join(
            [
                "Time,D,Position: Head_Buoy: East,Head North,D,Position: Tail_Buoy: East,Tail North",
                "00:00:10.000,D,1000.0,2000.0,D,1010.0,1990.0",
                "00:00:20.000,D,1001.0,2001.0,D,1011.0,1991.0",
            ]
        ),
        encoding="utf-8",
    )

    assert analyzer.scan_npd_headers(str(npd_path)) == ["Head_Buoy", "Tail_Buoy"]

    npd_df = analyzer.parse_npd_file(str(npd_path))
    assert list(npd_df.columns) == ["Time", "FRONT_X", "FRONT_Y", "TAIL_X", "TAIL_Y"]
    assert npd_df.iloc[0]["FRONT_X"] == pytest.approx(1000.0)
    assert npd_df.iloc[0]["TAIL_Y"] == pytest.approx(1990.0)

    track_path = tmp_path / "track.tsv"
    track_path.write_text(
        "\n".join(
            [
                "DAY\tHOUR\tMINUTE\tSECOND\tTRACENO\tFFID\tCHAN\tSOU_X\tSOU_Y",
                "1\t00\t00\t10.000\t100\t5000\t12\t10.0\t20.0",
                "1\t00\t00\t20.000\t101\t5001\t13\t11.0\t21.0",
            ]
        ),
        encoding="utf-8",
    )

    track_df = analyzer.parse_track_file(str(track_path))
    matched = analyzer.match_npd_with_track_fast(npd_df, track_df, tolerance_s=2)
    assert matched["TRACENO"].tolist() == [100, 101]
    assert matched["FFID"].tolist() == [5000, 5001]


def test_handle_scan_headers_suggests_default_positions(monkeypatch):
    monkeypatch.setattr(backend.analyzer, "scan_npd_headers", lambda _path: ["Tail_Buoy", "Head_Buoy"])

    result = backend.handle_scan_headers({"path": "dummy.npd"})

    assert result["headers"] == ["Tail_Buoy", "Head_Buoy"]
    assert result["default_head_position"] == "Head_Buoy"
    assert result["default_tail_position"] == "Tail_Buoy"
    assert result["suggested_head_position"] == "Head_Buoy"
    assert result["suggested_tail_position"] == "Tail_Buoy"


def test_handle_scan_headers_falls_back_to_first_two_headers(monkeypatch):
    monkeypatch.setattr(backend.analyzer, "scan_npd_headers", lambda _path: ["Streamer_A", "Streamer_B", "Gun"])

    result = backend.handle_scan_headers({"path": "dummy.npd"})

    assert result["suggested_head_position"] == "Streamer_A"
    assert result["suggested_tail_position"] == "Streamer_B"


def test_handle_run_analysis_returns_absolute_output_dir_and_trace_numbers(tmp_path, monkeypatch):
    npd_path = tmp_path / "sample.npd"
    npd_path.write_text("dummy", encoding="utf-8")
    track_path = tmp_path / "sample_track.tsv"
    track_path.write_text("dummy", encoding="utf-8")

    npd_df = pd.DataFrame(
        {
            "FRONT_X": [0.0, 1.0],
            "FRONT_Y": [0.0, 1.0],
            "TAIL_X": [0.5, 1.5],
            "TAIL_Y": [0.5, 1.5],
        }
    )
    track_df = pd.DataFrame(
        {
            "TRACENO": [10, 11],
            "FFID": [100, 101],
            "SOU_X": [0.0, 1.0],
            "SOU_Y": [0.0, 1.0],
        }
    )
    matched_df = pd.DataFrame(
        {
            "TRACENO": [10, 11],
            "FFID": [100, 101],
            "SOU_X": [0.0, 1.0],
            "SOU_Y": [0.0, 1.0],
            "FRONT_X": [0.0, 1.0],
            "FRONT_Y": [0.0, 1.0],
            "TAIL_X": [0.5, 1.5],
            "TAIL_Y": [0.5, 1.5],
        }
    )

    def _touch(path: str) -> None:
        Path(path).write_text("stub", encoding="utf-8")

    monkeypatch.setattr(backend.analyzer, "parse_npd_file", lambda *args, **kwargs: npd_df)
    monkeypatch.setattr(backend.analyzer, "parse_track_file", lambda *args, **kwargs: track_df)
    monkeypatch.setattr(backend.analyzer, "match_npd_with_track", lambda *args, **kwargs: matched_df)
    monkeypatch.setattr(backend.analyzer, "match_npd_with_track_fast", lambda *args, **kwargs: matched_df)
    monkeypatch.setattr(
        backend.analyzer,
        "calculate_feathering",
        lambda df, planned_azimuth: np.array([1.0, 2.0], dtype=float),
    )
    monkeypatch.setattr(backend.analyzer, "plot_feathering", lambda *args, **kwargs: _touch(args[7]) or {"mean": 1.5, "std": 0.5})
    monkeypatch.setattr(backend.analyzer, "plot_track", lambda *args, **kwargs: _touch(args[4]))
    monkeypatch.setattr(backend.analyzer, "plot_histogram", lambda *args, **kwargs: _touch(args[3]))
    monkeypatch.setattr(backend.analyzer, "generate_report", lambda *args, **kwargs: _touch(args[8]))
    monkeypatch.setattr(backend, "_generate_pdf", lambda pdf_path, *args, **kwargs: _touch(pdf_path))
    monkeypatch.setattr(backend.analyzer, "calculate_distance_along_line", lambda df: np.array([0.0, 2.0]))

    result = backend.handle_run_analysis(
        {
            "npd_path": str(npd_path),
            "track_path": str(track_path),
            "output_dir": "",
            "line_name": "",
            "planned_azimuth": 0,
            "feathering_limit": 0,
            "run_in_m": 0,
            "run_out_m": 0,
            "fast_match": False,
            "head_position": "Head_Buoy",
            "tail_position": "Tail_Buoy",
        }
    )

    assert result["output_dir"] == str(tmp_path.resolve())
    assert result["chart_data"]["trace_no"] == [10, 11]
    assert all(Path(path).is_absolute() for path in result["output_files"])


def test_handle_run_analysis_sanitizes_line_name_in_output_filenames(tmp_path, monkeypatch):
    npd_path = tmp_path / "sample.npd"
    npd_path.write_text("dummy", encoding="utf-8")
    track_path = tmp_path / "sample_track.tsv"
    track_path.write_text("dummy", encoding="utf-8")

    npd_df = pd.DataFrame(
        {
            "FRONT_X": [0.0, 1.0],
            "FRONT_Y": [0.0, 1.0],
            "TAIL_X": [0.5, 1.5],
            "TAIL_Y": [0.5, 1.5],
        }
    )
    track_df = pd.DataFrame(
        {
            "TRACENO": [10, 11],
            "FFID": [100, 101],
            "SOU_X": [0.0, 1.0],
            "SOU_Y": [0.0, 1.0],
        }
    )
    matched_df = pd.DataFrame(
        {
            "TRACENO": [10, 11],
            "FFID": [100, 101],
            "SOU_X": [0.0, 1.0],
            "SOU_Y": [0.0, 1.0],
            "FRONT_X": [0.0, 1.0],
            "FRONT_Y": [0.0, 1.0],
            "TAIL_X": [0.5, 1.5],
            "TAIL_Y": [0.5, 1.5],
        }
    )

    monkeypatch.setattr(backend.analyzer, "parse_npd_file", lambda *args, **kwargs: npd_df)
    monkeypatch.setattr(backend.analyzer, "parse_track_file", lambda *args, **kwargs: track_df)
    monkeypatch.setattr(backend.analyzer, "match_npd_with_track", lambda *args, **kwargs: matched_df)
    monkeypatch.setattr(backend.analyzer, "match_npd_with_track_fast", lambda *args, **kwargs: matched_df)
    monkeypatch.setattr(
        backend.analyzer,
        "calculate_feathering",
        lambda df, planned_azimuth: np.array([1.0, 2.0], dtype=float),
    )
    monkeypatch.setattr(
        backend.analyzer,
        "plot_feathering",
        lambda *args, **kwargs: {"mean": 1.5, "std": 0.5},
    )
    monkeypatch.setattr(backend.analyzer, "plot_track", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend.analyzer, "plot_histogram", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend.analyzer, "generate_report", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend, "_generate_pdf", lambda *args, **kwargs: None)
    monkeypatch.setattr(backend.analyzer, "calculate_distance_along_line", lambda df: np.array([0.0, 2.0]))
    monkeypatch.setattr(backend.os.path, "exists", lambda _path: True)
    monkeypatch.setattr(pd.DataFrame, "to_csv", lambda self, *args, **kwargs: None)

    result = backend.handle_run_analysis(
        {
            "npd_path": str(npd_path),
            "track_path": str(track_path),
            "output_dir": "",
            "line_name": r"..\escape:line/../Merged",
            "planned_azimuth": 0,
            "feathering_limit": 0,
            "run_in_m": 0,
            "run_out_m": 0,
            "fast_match": False,
            "head_position": "Head_Buoy",
            "tail_position": "Tail_Buoy",
        }
    )

    output_root = tmp_path.resolve()
    assert result["output_dir"] == str(output_root)
    assert result["output_files"], "Expected generated filenames to be returned"
    assert all(Path(path).resolve().is_relative_to(output_root) for path in result["output_files"])
    assert all(".." not in Path(path).name for path in result["output_files"])
    assert all("\\" not in Path(path).name and "/" not in Path(path).name for path in result["output_files"])
    assert all(":" not in Path(path).name for path in result["output_files"])


def test_feathering_math_helpers():
    df = pd.DataFrame(
        {
            "FRONT_X": [0.0, 3.0],
            "FRONT_Y": [0.0, 4.0],
            "TAIL_X": [0.0, 4.0],
            "TAIL_Y": [1.0, 4.0],
        }
    )

    feathering = analyzer.calculate_feathering(df, planned_azimuth=0)
    assert feathering.tolist() == pytest.approx([0.0, 90.0])

    distance = analyzer.calculate_distance_along_line(df)
    assert distance.tolist() == pytest.approx([0.0, 0.005])

    changes = analyzer.detect_feathering_changes(
        np.concatenate([np.zeros(40), np.ones(40) * 12.0]),
        feathering_limit=10.0,
    )
    assert isinstance(changes, list)
