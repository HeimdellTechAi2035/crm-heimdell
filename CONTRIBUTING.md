# Contributing to Heimdell CRM

Thank you for your interest in contributing to Heimdell CRM!

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/heimdell-crm.git`
3. Follow the setup instructions in [SETUP.md](./SETUP.md)
4. Create a branch: `git checkout -b feature/your-feature-name`

## Code Standards

### TypeScript
- Use TypeScript for all new code
- Avoid `any` types
- Use interfaces for public APIs
- Use types for internal logic

### Backend (API)
- Follow REST conventions
- Use Zod for validation
- Add OpenAPI/Swagger docs for new routes
- Write tests for new endpoints
- Use Prisma for database access
- Follow existing patterns in `/apps/api/src/routes`

### Frontend (Web)
- Use React functional components with hooks
- Use TanStack Query for server state
- Use Zustand for client state
- Follow shadcn/ui patterns for components
- Keep components small and focused
- Use Tailwind for styling

### Naming Conventions
- Files: kebab-case (user-profile.tsx)
- Components: PascalCase (UserProfile)
- Functions: camelCase (getUserProfile)
- Constants: UPPER_SNAKE_CASE (MAX_RETRIES)

## Pull Request Process

1. **Create a branch** from `develop` (not `main`)
2. **Make your changes**
   - Write clear, descriptive commit messages
   - Keep commits focused and atomic
3. **Add tests**
   - API: Add tests in `/apps/api/src/tests`
   - Ensure existing tests pass: `pnpm test`
4. **Update documentation**
   - Update README.md if adding features
   - Update SETUP.md if changing setup
   - Add JSDoc comments to public functions
5. **Lint your code**
   - Run `pnpm lint` and fix any issues
6. **Submit PR**
   - Provide clear description
   - Reference any related issues
   - Request review from maintainers

## Commit Messages

Follow conventional commits:

```
feat: add lead export functionality
fix: resolve date formatting issue
docs: update API documentation
test: add tests for deal routes
refactor: simplify auth middleware
style: fix linting errors
chore: update dependencies
```

## Areas for Contribution

### High Priority
- Additional CRM objects (Contacts, Quotes)
- More AI features (sentiment analysis, email writing)
- Enhanced reporting and analytics
- Mobile responsive improvements
- Additional integrations (Twilio, Slack)

### Good First Issues
- UI/UX improvements
- Documentation updates
- Test coverage
- Bug fixes
- Performance optimizations

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Review existing issues and PRs

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

Thank you for contributing! 🎉
