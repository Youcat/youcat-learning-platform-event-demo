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
- Total duration: 35.6 seconds
- Authentication: 0.38 seconds for all 200 users
- Answer propagation: median 1.81 seconds; maximum 3.52 seconds
- Heart propagation: median 3.69 seconds; maximum 5.29 seconds
- Snapshot callbacks handled: 14,760

The emulator briefly retried some writes during the intentionally simultaneous bursts. All operations completed successfully. This is a conservative stress condition; real participants will naturally spread actions over several minutes.

## Public GitHub Pages result

Two tests used 200 simultaneous connections:

| Resource | Successful responses | Median | 99th percentile | Maximum |
| --- | ---: | ---: | ---: | ---: |
| HTML page | 200/200 | 284 ms | 613 ms | 789 ms |
| Main JavaScript bundle | 200/200 | 887 ms | 1,443 ms | 1,777 ms |

## Spark-plan budget estimate

The test scenario uses about 3,000 Firestore writes and an estimated 31,000–40,000 reads. This fits the daily Spark allowance if the demo is the project's primary activity that day. Repeated reconnects or additional rehearsals on the same day increase read usage.

## Remaining live-event requirement

Firebase Authentication normally limits new account creation to 100 accounts per IP address per hour. The event uses a shared venue network, so a temporary increase should cover 26 July 2026 from 11:00 to 18:00 in `America/Sao_Paulo`.
