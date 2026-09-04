# Default training library

The built-in library is intended to give a useful starting point for common robot practice rather than demonstrate graph-editor features. Single-shot feeds and systematic footwork drills remain deterministic. Bounded shot variation is used where unpredictability is part of the training goal: random placement, match-like patterns, spin recognition and dedicated variable-practice drills.

## Shot feeds

All default feeds assume the **back of the robot base** is centered on the near edge. Their launch coordinates come from the fixed measured chain: base back -> yaw pivot 24.2 cm, yaw -> pitch pivot 7.5 cm, pitch pivot -> wheels 7.5 cm, with the yaw pivot 24.0 cm above the support surface. Aim and elevation therefore move the physical release point. The presets were re-solved with the app's current aerodynamic trajectory model. Target points deliberately stay well away from the table edges, and modeled net clearance is normally 8–12 cm to tolerate ordinary shot-to-shot variation.

Built-in deterministic shot feeds:

- No-spin center
- Short no-spin
- Short underspin to forehand
- Short underspin to backhand
- Topspin to forehand
- Topspin to backhand
- Long wide topspin to forehand
- Long wide topspin to backhand
- Topspin to elbow
- Heavy topspin center
- Backspin center
- Fast deep center

The pattern drills additionally use corresponding forehand/backhand backspin, middle-placement topspin, and fast-deep corner feeds.

Where a drill enables variation, it is deliberately scaled by feed type:

- ordinary rally balls vary by up to 12 cm in depth and 10 cm laterally, with modest speed, spin and clearance ranges;
- short balls use an 8 cm placement envelope so they remain recognizably short;
- deep and fast-deep balls use only 6–7 cm placement variation to retain end-line margin;
- heavy-topspin and backspin feeds receive wider spin ranges while keeping their spin direction and tactical identity;
- nominal targets remain unchanged and every varied ball is solved jointly for placement, clearance, speed and spin before it is sent to the robot.

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
- Variable topspin rally
- Variable short receive
- Short forehand underspin → wide recovery (random long wide BH/FH)
- Short backhand underspin → two wide forehand recovery balls
- Short receive → weighted random long attack
- Backhand exchange → weighted stay/elbow/wide-forehand switch
- Seven-ball weighted match rally (45% BH / 20% elbow / 35% FH)
- Random pattern mix, which weights and chooses among the match-like patterns above

The short-opening patterns are intended for flick/receive practice followed by recovery into a more match-like long ball. The random pattern mix uses reusable sub-drills, so a set chooses a whole tactical pattern rather than randomizing every individual ball independently.

## Serve / receive drills

The built-in Serve / receive folder contains modeled serves whose server-side
first bounce, post-bounce net crossing, and receiver-side first bounce are all
valid with the default table and centered robot pose. The preview then follows
a third arc to the receiver's second bounce or the 0.5 m outside-table limit:

- Short backspin to backhand
- Short backspin to forehand
- Short no-spin to middle
- Fast long topspin to backhand
- Short backspin → third-ball attack
- Fast long → backhand pressure
- Backspin / no-spin recognition
- Short or fast-long random
- Mixed serve + random third ball
- Combination mix, which chooses whole serve-and-follow-up sub-drills

The recognition drills randomize serve families and placements. The follow-up
drills represent the server's next ball after the player receives the serve.
Serve variation is deliberately tighter than ordinary rally-ball variation and
invalid modeled samples are skipped. Technique names that require a verified
sidespin axis are intentionally omitted; the current model supports top/back
spin only.

These choices follow common serve/receive practice principles: vary placement,
speed and spin; mix short backspin or no-spin with fast-long serves; attack long
serves; and train the serve together with the expected third-ball response.

These patterns are based on widely used coaching and robot-training patterns. In particular, Butterfly's training material describes forehand/backhand alternating, one-one footwork, random three-spot placement, the two-one/Falkenberg family, and whole-table random work; Butterfly also documents Timo Boll's 2-2 robot drill. Newgy robot training material uses related forehand/backhand, middle/random, backhand/random and spin-switching exercises. Expert Table Tennis describes the standard Falkenberg sequence as backhand, forehand from the backhand corner, then wide forehand.

References:

- https://www.butterflyonline.com/tip-of-the-week-six-step-training-progression/
- https://butterflyonline.com/random-drills-placement/
- https://butterflyonline.com/timo-boll-webcoach-the-2-2-drill/
- https://www.experttabletennis.com/the-falkenberg-drill/
- https://www.newgy.com/blogs/coaching-tips
- https://www.newgy.com/files/s/files/1/2677/3302/files/newgy_robo_pong_training_manual_74f5fe53-ef96-4786-8752-399bef2c9f20_2644323985325488869.pdf
- https://www.ittf.com/2020/04/11/stay-home-train-serve/
- https://newsarchive.tabletennisengland.co.uk/news/archived/service-and-spin/
- https://newsarchive.tabletennisengland.co.uk/news/archived/return-of-serve/

## Robustness assumptions

The model is still an estimate. Built-in feeds therefore avoid precision targets on sidelines, end lines, and just over the net. A typical default target leaves roughly 25 cm or more lateral/end-line margin and at least about 8 cm modeled net clearance. Real calibration, ball condition, wheel stabilization and robot mechanics can shift the landing point by several centimetres.


## Storage and editing

The presets in this file are shipped as the read-only **Built-in** library. They are generated by the app release and are not stored in browser local storage. To inspect or change a drill's enabled variation ranges, use **Copy to My drills**; the copy becomes normal user data and can be placed in nested virtual folders.
