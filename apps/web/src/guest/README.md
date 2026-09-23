# Guest

Phone controller for `/` and `/j/:code`.

| File             | Purpose                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `guest-page.tsx` | Join code, nickname, reconnect, the question, and accepted or rejected answers |

The page joins a lobby and answers on this phone. In the lobby it can like or dislike other nicknames. It does not score and it does not start a round. `/j/:code` prefills the join code from the QR address. A second tap while a send is in flight is ignored. Leaving the page during a live question asks the browser to confirm. Lobby and podium do not. The status line covers waiting, sending, accepted, rejected, paused, reconnecting, and completed. A held reveal or scoreboard still explains the result. Other held phases say the phone is waiting for the host.
