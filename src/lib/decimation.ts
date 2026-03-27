/**
 * Largest Triangle Three Buckets (LTTB) downsampling algorithm.
 * Preserves visual shape of time-series data while reducing point count.
 * Reference: Sveinn Steinarsson, 2013
 */

export interface DataPoint {
  x: number;
  y: number;
  [key: string]: unknown;
}

export function lttbDecimate<T extends DataPoint>(
  data: T[],
  targetPoints: number
): T[] {
  if (data.length <= targetPoints || targetPoints < 3) {
    return data;
  }

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (targetPoints - 2);

  // Always keep first point
  sampled.push(data[0]);

  let prevSelectedIndex = 0;

  for (let i = 0; i < targetPoints - 2; i++) {
    // Calculate bucket boundaries
    const bucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const bucketEnd = Math.min(
      Math.floor((i + 2) * bucketSize) + 1,
      data.length - 1
    );

    // Calculate average of next bucket (for triangle area)
    const nextBucketStart = Math.floor((i + 2) * bucketSize) + 1;
    const nextBucketEnd = Math.min(
      Math.floor((i + 3) * bucketSize) + 1,
      data.length - 1
    );

    let avgX = 0;
    let avgY = 0;
    const nextBucketLen = Math.max(1, nextBucketEnd - nextBucketStart);
    for (let j = nextBucketStart; j < nextBucketEnd; j++) {
      avgX += data[j].x;
      avgY += data[j].y;
    }
    avgX /= nextBucketLen;
    avgY /= nextBucketLen;

    // Find the point in current bucket that maximizes triangle area
    const prevX = data[prevSelectedIndex].x;
    const prevY = data[prevSelectedIndex].y;

    let maxArea = -1;
    let maxAreaIndex = bucketStart;

    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs(
        (prevX - avgX) * (data[j].y - prevY) -
          (prevX - data[j].x) * (avgY - prevY)
      );
      if (area > maxArea) {
        maxArea = area;
        maxAreaIndex = j;
      }
    }

    sampled.push(data[maxAreaIndex]);
    prevSelectedIndex = maxAreaIndex;
  }

  // Always keep last point
  sampled.push(data[data.length - 1]);

  return sampled;
}
