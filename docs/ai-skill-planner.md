# AI skill planner contract

The skill planner keeps coaching intent separate from robot launch parameters.
AI proposes the outcome a player should receive; the app's calibrated trajectory
and Nova hardware models choose the physical settings.

## Flow

1. Send the player request, prior creation/edit history, and current saved skill
   when editing.
2. AI returns stages, drills, and intuitive ball-outcome intervals.
3. The app solves every ball against the active calibration and Nova limits.
4. If any ball is infeasible, the app returns its requested intervals, the
   nearest modeled outcome, and a reason to the AI.
5. AI may revise the complete skill twice. Only a fully feasible result is shown
   as validated and can be saved.

Manual external-AI mode copies the same feasibility report into a revision
request. The user pastes the revised response back into the app.

## Coordinates and outcomes

All placements refer to the robot's incoming feed on the receiver half:

- `depthCm`: `0` at the net and `137` at the receiver end line.
- `lateralCm`: `0` at the center line; positive toward the robot's left, which
  is the forehand side of a right-handed receiver; negative toward the robot's
  right.
- `speedMps`: launch-speed interval.
- `spinRps`: positive topspin, negative backspin, approximately zero no-spin.
- `netClearanceCm`: clearance above the top of the net.

Every outcome is an inclusive `[minimum, maximum]` interval matching the app's
Intuitive shot editor. A normal `shot` targets the receiver-side first bounce.
A `serve` targets the receiver-side second physical bounce.

The requested direction of the player's return is coaching guidance, not an
incoming-feed coordinate. For example, a right-handed step-around opening down
the line still receives backspin in the backhand corner; “down the line” belongs
in the stage focus and completion target.

## Schematic response

```json
{
  "format": "table-tennis-robot-studio/skill",
  "formatVersion": 2,
  "name": "Aggressive forehand step-around opening",
  "description": "Assumes a right-handed player.",
  "accent": "#55c98c",
  "stages": [
    {
      "title": "Contact before power",
      "goal": "Open reliably from the backhand corner.",
      "focus": "Brush the backspin and direct the return down the line.",
      "target": "Land 8 of 10 returns down the line.",
      "drills": [
        {
          "name": "Set-position opening",
          "description": "A predictable backspin feed isolates contact.",
          "repetitions": 4,
          "adaptiveSpeedPct": 75,
          "balls": [
            {
              "id": "opening-1",
              "type": "shot",
              "label": "Backspin to backhand corner",
              "outcome": {
                "depthCm": [62, 82],
                "lateralCm": [-52, -38],
                "speedMps": [4.6, 5.4],
                "spinRps": [-23, -15],
                "netClearanceCm": [8, 14]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

The AI may choose 1–12 stages and 1–6 drills per stage, up to 36 drills total.
Each drill may contain 1–24 sequential balls.
