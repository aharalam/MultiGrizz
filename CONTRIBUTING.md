# Team workflow

## Layout and ownership

- `frontend/`: Two frontend teammates; branch `frontend`.
- `backend/`: Two backend teammates; branch `backend`.
- `contracts/`: Shared API agreements; coordinate changes between both pairs.
- `main`: Integrated application; both branches start at the same initial commit.

Frontend and backend are independent applications in one repository. Each gets its own dependency manifest, lockfile, environment configuration, and build. No application has been scaffolded yet.

## Join and work

After accepting the owner's GitHub invitation, clone the repository and choose your branch:

```powershell
git clone https://github.com/aharalam/grizzhacks-oakland-university.git
cd grizzhacks-oakland-university
git switch frontend
# Backend teammates use: git switch backend
```

Before each session, run `git pull --ff-only`. Commit and push small checkpoints. Since two people share each work branch, divide files and pull before pushing. Never force-push over a teammate's work. If a push is rejected, fetch and merge the remote work branch, resolve conflicts together, then push.

Keep frontend changes in `frontend/` and backend changes in `backend/`. Coordinate shared contract and root documentation edits. Branches are collaboration boundaries, not GitHub permission boundaries: repository collaborators can see both.

## Integrate at the end

1. Commit and push both work branches.
2. Open a pull request from `frontend` into `main`, review it, and merge it.
3. Merge the updated `origin/main` into `backend`, resolving any shared-file conflicts, and verify the combined application.
4. Open a pull request from `backend` into `main`, review it, and merge it.
5. Pull `main` and run the integrated demo, checking login, player-team isolation, agent execution, and live updates.

Do not merge or delete the work branches until the team is ready. Branch protection has not been configured. Never commit `.env` files or API keys; copy each application's `.env.example` to a local `.env` when configuring it.
