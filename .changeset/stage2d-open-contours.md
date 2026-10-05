---
"@vitavision/stage2d": minor
---

Open contours, and arc-length helpers for measuring and editing a contour along its length.

- **`ContourEditor` `closed?: boolean`** (default `true`, as before). With `closed={false}` the contour is drawn as an open polyline (no segment from the last vertex back to the first), Delete keeps at least two vertices (three for a closed contour), Insert on the last vertex adds one midway to the vertex before it, and a double-click near the gap between the ends adds nothing.
- **`nearestContourSegment(points, point, closed = true)`** takes an optional third argument; `false` leaves out the closing segment.
- **Arc-length helpers**, pure functions over `Point[]` that work open (the default) or closed:
  - `arcLengths(points, closed)`: the cumulative length at each vertex (a closed path has one more entry, its perimeter).
  - `pointAtArc(points, s, closed)`: the point at distance `s` along the path, clamped on an open path and wrapped on a closed one.
  - `projectToArc(points, p, closed)`: the nearest place on the path to `p`, as `{ s, point, distance }`.
  - `subPath(points, s0, s1, closed)`: the stretch between two distances; on a closed path with `s0 > s1` it runs on past the first vertex.
  - `normalAtArc(points, s, closed)`: the unit normal, the tangent turned a quarter turn clockwise on screen (image `y` points down), so it points inward on a contour whose vertices run clockwise.
  - `deformContour(points, centre, delta, radius, closed)`: a soft round brush push with a cosine falloff, dividing the segments under the brush first so the path bends smoothly.
  - `eraseArc(points, s0, s1, closed)`: the pieces left after erasing a stretch; an open path leaves up to two, a closed one a single open piece.
