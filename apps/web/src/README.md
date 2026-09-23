# Web app

React screens for the party. Vite builds them, and the API Worker serves the build.

| Folder    | Route        | Purpose                        |
| --------- | ------------ | ------------------------------ |
| `guest`   | `/`          | Phone controller shell         |
| `stage`   | `/host`      | Projector shell                |
| `admin`   | `/admin`     | Operator shell                 |
| `results` | `/r/:gameId` | Results shell                  |
| `ui`      | Shared       | Controls used by those screens |

`game`, `media`, and `stats` folders are intentionally absent. Add each one in the prompt that first needs it.
