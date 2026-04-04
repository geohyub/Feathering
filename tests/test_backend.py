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
