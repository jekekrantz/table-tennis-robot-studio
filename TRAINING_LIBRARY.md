# Default training library

The built-in library is intended to give a useful starting point for common robot practice rather than demonstrate graph-editor features.

## Shot feeds

All default feeds assume the robot is centered at the near edge, the nozzle is 26.5 cm from the back of the base, and the nozzle center is 22.5 cm above the tabletop. They were numerically solved with the app's current aerodynamic trajectory model. Target points deliberately stay well away from the table edges, and modeled net clearance is normally 8–12 cm to tolerate ordinary shot-to-shot variation.

Built-in shot feeds:

- No-spin center
- Short no-spin
- Topspin to forehand
- Topspin to backhand
- Topspin to elbow
- Heavy topspin center
- Backspin center
- Fast deep center

The pattern drills additionally use corresponding forehand/backhand backspin, middle-placement topspin, and fast-deep corner feeds.

For a right-handed player standing at the far end, positive lateral placement is the player's forehand side and negative placement is the player's backhand side.

## Pattern drills

The default drill set includes:

- Forehand / backhand alternating
- 2-2 forehand / backhand
- Falkenberg
- Three-point footwork
- Forehand half-table footwork
- Backhand half-table footwork
- Backhand + random forehand
- Forehand, backhand, random
- Three spots random
- Topspin / backspin switching
- Backspin corners
- Fast deep random

These patterns are based on widely used coaching and robot-training patterns. In particular, Butterfly's training material describes forehand/backhand alternating, one-one footwork, random three-spot placement, the two-one/Falkenberg family, and whole-table random work; Butterfly also documents Timo Boll's 2-2 robot drill. Newgy robot training material uses related forehand/backhand, middle/random, backhand/random and spin-switching exercises. Expert Table Tennis describes the standard Falkenberg sequence as backhand, forehand from the backhand corner, then wide forehand.

References:

- https://www.butterflyonline.com/tip-of-the-week-six-step-training-progression/
- https://butterflyonline.com/random-drills-placement/
- https://butterflyonline.com/timo-boll-webcoach-the-2-2-drill/
- https://www.experttabletennis.com/the-falkenberg-drill/
- https://www.newgy.com/blogs/coaching-tips
- https://www.newgy.com/files/s/files/1/2677/3302/files/newgy_robo_pong_training_manual_74f5fe53-ef96-4786-8752-399bef2c9f20_2644323985325488869.pdf

## Robustness assumptions

The model is still an estimate. Built-in feeds therefore avoid precision targets on sidelines, end lines, and just over the net. A typical default target leaves roughly 25 cm or more lateral/end-line margin and at least about 8 cm modeled net clearance. Real calibration, ball condition, wheel stabilization and robot mechanics can shift the landing point by several centimetres.
