# 200-user load-test report

Updated: 14 July 2026

## Event scenario

- 200 participants
- 20 rooms with 10 participants each
- 5 questions per participant
- 5 reflections and 10 hearts per participant
- persistent personal XP and one group-XP contribution per participant
- two live leaderboard layers: members within the current group and 20 group summaries
- 200 maximum concurrent Firestore listeners
- 1,000 reflection writes, 2,000 heart writes, and 600 leaderboard document writes

## Local Firebase emulator result

- Result: passed
- Errors: 0
- Total duration: 23.9 seconds
- Authentication: 0.16 seconds for all 200 users
- Answer propagation: median 1.06 seconds; maximum 1.12 seconds
- Heart propagation: median 1.95 seconds; maximum 2.17 seconds
- Leaderboard convergence after 200 simultaneous transactions: 7.23 seconds
- Snapshot callbacks handled: 14,704
- Global reflection totals and the cross-group overview query were verified after every question
- All 20 group leaderboards reached 10 active members and all 20 group summaries reached the correct totals

The emulator briefly retried some writes during the intentionally simultaneous bursts. All operations completed successfully. This is a conservative stress condition; real participants will naturally spread actions over several minutes.

## Public GitHub Pages result

Two tests used 200 simultaneous connections:

| Resource | Successful responses | Median | 99th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HTML page | 200/200 | 284 ms | 613 ms | 789 ms |
| Main JavaScript bundle | 200/200 | 887 ms | 1,443 ms | 1,777 ms |

## Spark-plan budget estimate

The test scenario uses about 3,600 Firestore document writes. The event leaderboard reads 20 summary documents instead of all 200 participant-contribution documents, and listeners are opened only on the dedicated leaderboard screen. The estimated event usage remains within the daily Spark allowance if this demo is the project's primary activity that day. Repeated reconnects or additional rehearsals on the same day increase read usage.

## Scheduled live-event quota

Firebase Authentication normally limits new account creation to 100 accounts per IP address per hour. A temporary quota of 500 sign-ups per hour is scheduled for 26 July 2026, starting at 10:00 in `America/Sao_Paulo` and lasting 24 hours. The Firebase project remains on the no-cost Spark plan.
