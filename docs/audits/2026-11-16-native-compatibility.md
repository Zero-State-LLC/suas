# Native compatibility and independent SES review

## Checkout identities and authority

- iOS HEAD: `f6eccc98073b1100c9f771eba5e776e4bbe576b2`.
- Android HEAD: `5bf2ba3aad99970e90326f2f59bd044bb31ce301`.
- Both clients explicitly pin spec `0.6.0`, manifest `RELEASE_MANIFEST-0.6.0.md`; neither claims 0.9/0.10 conformance. Read their AGENTS.md and CONTEXT.md. Both checkouts remain clean.
- Server pins 0.9.0. Compared its request contract with `/workspace/suas-specs` and upstream 0.10.0; upstream annotated tag v0.10.0 peels to `6cd437e61b11f67e04b2bd91101d33f7c09c0fce`. 0.10.0 does not automatically update native pins or authorize Round 12 (deferred to 0.11).

## P1: existing native request submissions are incompatible with server details validation

Server `src/http/routes/service-requests.ts:68-72` now parses `details` with strict `draftDetailsInput.partial()` (`src/intake/tools.ts:41-48`): only summary, timing, meeting_place and string destination are accepted. SUBMIT additionally requires meeting_place for FOOD, TRANSPORTATION and SHELTER (`src/coordination/requests.ts:312-319`).

- **iOS** `suas/suas/AppState.swift:130-148` always sends a `location` object; rides add an object-valued `destination`; food may add meal/allergies. Every current iOS request therefore fails create validation. Ride UI also requires a destination (`RequestFlowView.swift:197`), while DISPATCH §14.9 makes it optional and bounded text without maps.
- **Android** `ConnectedRequestScreen.kt:192-199` sends pickup_label/destination_label for rides, and note for other categories. Those are unknown keys and fail create. An empty FOOD/SHELTER body passes create but then fails SUBMIT because no meeting_place was collected. Empty PEER_SUPPORT can still submit. Ride destination is unnecessarily required at line 180.

Executed the actual server Zod schema against synthetic payloads matching native builders: iOS ride failed with `Expected string, received object` at destination and unknown location; Android ride failed unknown pickup_label/destination_label; Android food note failed unknown note. Empty Android food passed schema (subsequent meeting-place rejection established from source). This is a real existing-flow incompatibility, not simply absence of new features. Add cross-client payload contract fixtures; update native forms/body builders to canonical bounded text and optional ride destination, keeping explicit pins and rollout decisions coordinated.

## Scope matrix: distinguish missing adoption from broken wire behavior

| Area                | Observation                                                                                                                       | Classification                                                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Edit / RELEASE      | Neither native API/service inventory implements these commands as a product journey                                               | 0.9 adoption backlog; no broken advertised command found                                                                                                                       |
| Live / earlier chat | Neither native API inventory has chat message/thread calls; Android guidance and D033_CHAT_PARITY remain 0.6 unavailable behavior | Native adaptation needed before claiming 0.9 chat parity; no evidence they leak released threads                                                                               |
| Check-In resume     | No Check-In endpoint in either native API inventory                                                                               | No implemented resume request to mismatch; no 24-hour native conformance claim                                                                                                 |
| Resource contacts   | Native catalog reads only shelter preview names; DTOs omit contact list and legacy contact fields                                 | Additive fields are ignored, not a decode break; native directory/contact UX is adoption work                                                                                  |
| Crisis              | Both ship local person-initiated tel:911, tel:988, sms:988; no sms:838255                                                         | Consistent with their 0.6 pin. MOBILE_SURFACE §6.6 / §11.5 explicitly requires Text 838255 when the client pins tagged 0.8+. Do not call absence alone a current 0.6 violation |

## Verification and toolchain limits

- Both `scripts/openapi-client-pin.py /workspace/suas/docs/openapi/v0.json` pass. These checks compare route inventories, not payload schemas, and miss the confirmed mismatch.
- iOS project check passes 99 checks; release-bundle checker tests pass 17 tests.
- Android forbidden-capability scan passes.
- iOS `scripts/linux-check.sh` cannot run: `swiftc: command not found`; Swift and Xcode are absent. Simulator/archive validation needs a Mac.
- Java 21 is installed; Android Gradle daemon config requests Java 25, and no Android SDK was located in conventional /opt or /usr/local paths. Gradle 9.5 wrapper is uncached. Attempted offline unit test with temporary GRADLE_USER_HOME; wrapper still attempted distribution download and failed `java.net.SocketException: Operation not permitted`. No native build or emulator verification claim.

## Independent review of shared SES correction

Reviewed diff in schema.ts, backend-stack.ts, related env/docs/tests. No new safety defect found: `validateAwsCapabilities` always rejects SES for every environment before usable configuration; both API/job-worker deployments use sink; SES IAM send permissions are removed. This restores the server's pinned 0.9 D-004 boundary. 0.10 authorizes synthetic Gmail SMTP, not SES, so it does not justify enabling SES. Adapter unit constructors remain available for fake-port testing; normal runtime config cannot select them.

Ran updated `aws-config.test.ts` and `ses-email.test.ts`: **27 tests passed**. Configuration/IAM tests change the former permissive expectations to explicit refusal rather than retaining unsafe behavior for green tests. Operational limitation: sink cannot deliver real staging email; deploy only with an explicitly coordinated synthetic sign-in path or a separately approved supported provider. No deployment performed.
