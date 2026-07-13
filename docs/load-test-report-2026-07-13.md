# 200-user load-test report

Date: 13 July 2026

## Event scenario

- 200 participants
- 20 rooms with 10 participants each
- 5 questions per participant
- 5 reflections and 10 hearts per participant
- 200 maximum concurrent Firestore listeners
- 1,000 reflection writes and 2,000 heart writes

## Local Firebase emulator result

- Result: passed
- Errors: 0
- Total duration: 21.2 seconds
- Authentication: 0.16 seconds for all 200 users
- Answer propagation: median 1.15 seconds; maximum 1.97 seconds
- Heart propagation: median 2.24 seconds; maximum 2.95 seconds
- Snapshot callbacks handled: 14,492
- Global reflection totals and the cross-group overview query were verified after every question

The emulator briefly retried some writes during the intentionally simultaneous bursts. All operations completed successfully. This is a conservative stress condition; real participants will naturally spread actions over several minutes.

## Public GitHub Pages result

Two tests used 200 simultaneous connections:

| Resource | Successful responses | Median | 99th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HTML page | 200/200 | 284 ms | 613 ms | 789 ms |
| Main JavaScript bundle | 200/200 | 887 ms | 1,443 ms | 1,777 ms |

## Spark-plan budget estimate

The test scenario uses about 3,000 Firestore writes and an estimated 31,000–40,000 reads. This fits the daily Spark allowance if the demo is the project's primary activity that day. Repeated reconnects or additional rehearsals on the same day increase read usage.

## Scheduled live-event quota

Firebase Authentication normally limits new account creation to 100 accounts per IP address per hour. A temporary quota of 500 sign-ups per hour is scheduled for 26 July 2026, starting at 10:00 in `America/Sao_Paulo` and lasting 24 hours. The Firebase project remains on the no-cost Spark plan.
