# Intelehealth Health Worker Webapp

A modern, high-performance web application built for health workers, providing an intuitive interface for managing healthcare workflows and patient interactions.

## 🚀 Tech Stack

- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7.1.3 (optimized for performance)
- **Package Manager**: Yarn
- **Language**: TypeScript (strict mode enabled)
- **Styling**: CSS with modern design principles
- **Testing**: Vitest + React Testing Library (100% coverage required)
- **State Management**: React useReducer with centralized reducers
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks

## 🛠️ Development Setup

### Prerequisites

- Node.js (version 18 or higher)
- Yarn package manager
- VS Code (recommended editor)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ih-hw-webapp

# Install dependencies
yarn install

# Start development server
yarn dev
```

### Available Scripts

- `yarn dev` - Start development server with hot reload
- `yarn build` - Build for production (optimized)
- `yarn lint` - Run ESLint for code quality
- `yarn lint:fix` - Auto-fix ESLint issues
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check code formatting
- `yarn preview` - Preview production build locally
- `yarn analyze` - Analyze bundle size and composition (generates visual report)
- `yarn type-check` - Run TypeScript type checking
- `yarn pre-commit` - Run all pre-commit checks manually (formatting, linting, type-check, tests, build)

### Testing Scripts

- `yarn test` - Run tests in watch mode
- `yarn test:ui` - Run tests with Vitest UI
- `yarn test:run` - Run tests once
- `yarn test:coverage` - Run tests with coverage report (100% required)
- `yarn test:watch` - Run tests in watch mode

### Git Hooks & Quality Assurance

This project uses **Husky** to enforce code quality standards before each commit. The pre-commit hook automatically runs:

1. **Code Formatting & Linting** - Formats and lints staged files using ESLint and Prettier
2. **Type Checking** - Runs TypeScript type checking (`yarn type-check`)
3. **Tests** - Executes all tests (`yarn test:run`)
4. **Build Verification** - Ensures the project builds successfully (`yarn build`)

**Benefits:**

- ✅ Prevents broken code from being committed
- ✅ Ensures consistent code style
- ✅ Catches type errors early
- ✅ Maintains test coverage
- ✅ Guarantees build success

**Note:** All checks must pass before a commit is allowed. If any check fails, the commit will be blocked until issues are resolved.

## 🌐 Access

- **Development**: http://localhost:3000 (optimized port)
- **Production**: [To be configured]

## 🔧 Environment Configuration

Create a `.env` file based on `.env.example`:

```bash
# Development
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development

# Production
VITE_API_URL=https://api.production.com
VITE_SENTRY_DSN=your_production_dsn
VITE_APP_ENV=production
```

**Environment Variables:**

- `VITE_API_URL` - Backend API endpoint
- `VITE_SENTRY_DSN` - Sentry error tracking DSN (production only)
- `VITE_APP_ENV` - Application environment (development/staging/production)
- `VITE_ENABLE_SITE_CAPTCHA` - Toggle Google reCAPTCHA on the login form (`true`/`false`). When `false` or unset, the captcha is not rendered and submit is ungated.
- `VITE_RECAPTCHA_SITE_KEY` - Google reCAPTCHA v2 site key. Required when `VITE_ENABLE_SITE_CAPTCHA=true`; if empty, the captcha is skipped regardless of the flag.

**Note:** `VITE_SENTRY_DSN` is only required in production. Sentry is automatically disabled in development for better performance.

## 🤖 Automated PR Review

Pull requests into `main` or `dev` are reviewed against a written rulebook at [.github/review/review-rules.md](.github/review/review-rules.md) — 67 rules in twelve categories:

| Prefix  | Covers                                             | Prefix | Covers                                   |
| ------- | -------------------------------------------------- | ------ | ---------------------------------------- |
| `SEC`   | Security                                           | `TS`   | TypeScript and code health               |
| `PHI`   | Patient and personal data                          | `OPS`  | Configuration, deployment, observability |
| `DATA`  | Databases, ORMs, migrations                        | `API`  | Interfaces and contracts                 |
| `ASYNC` | Async, errors, and control flow                    | `TEST` | Tests                                    |
| `RT`    | Realtime: Socket.IO and WebRTC                     | `STD`  | Project standards from this README       |
| `FE`    | Frontend: React, Angular, Vue, Ionic, React Native | `GEN`  | Uncategorised                            |

### How it runs

**Every PR is reviewed automatically when you open it.** No label needed.

| You do                 | What happens                                         |
| ---------------------- | ---------------------------------------------------- |
| Open a PR              | Reviewed automatically. Red if it finds something    |
| Push a commit          | Check goes red: the review is stale. Nothing re-runs |
| Add **`review-again`** | Fresh review of the new code                         |

Pushing does not re-review on its own — that would spend a review on every
commit. It marks the existing result stale so a passing review cannot cover code
you have since changed.

### What blocks a merge

Two independent gates, and it is worth knowing they are separate:

| Gate                       | Cleared by                                        | Enforced by              |
| -------------------------- | ------------------------------------------------- | ------------------------ |
| The `review` check         | Fixing the code, then asking for a fresh review   | This workflow            |
| Unresolved review comments | Clicking **Resolve conversation** on every thread | GitHub branch protection |

**Resolving a comment does not clear the check.** The reviewer recomputes from the current diff each time — if the code still has the problem, the next review finds it again. Resolve the thread _and_ fix the code.

A push always resets the check to red: a review that passed against code you have since changed should not keep the merge open.

### Adding a rule

Edit [.github/review/review-rules.md](.github/review/review-rules.md) — that file is the entire configuration. There is no generated companion file and no sync step to run. Format is one bold line plus prose:

```markdown
**FE-008 · minor · Inline styles on a new component.** Style via the project's
CSS modules instead, so theming stays in one place.
```

Severity (`blocker | major | minor | nit`) decides what survives the comment cap and what the merge gate blocks on. Design notes: [.github/review/README.md](.github/review/README.md).

## 📁 Project Structure

```
ih-hw-webapp/
├── src/
│   ├── App.tsx                    # Main application component (optimized with memo)
│   ├── main.tsx                   # Application entry point
│   ├── App.css                    # Main application styles
│   ├── assets/                    # Static assets
│   ├── components/                # Reusable UI components
│   ├── config/                    # Configuration files
│   ├── services/                  # HTTP and API services
│   ├── hooks/                     # Custom React hooks
│   ├── types/                     # Common TypeScript types
│   ├── reducers/                  # Common state reducers
│   ├── utils/                     # Utility functions (storage, etc.)
│   ├── test/                      # Test utilities and setup
│   ├── examples/                  # Development examples and patterns
│   │   ├── http-examples.tsx      # HTTP service usage examples
│   │   ├── redux-concepts.tsx     # Redux-like state management
│   │   ├── api-examples.tsx       # API service usage examples
│   │   ├── index.ts               # Examples exports
│   │   └── CODING_GUIDELINES.md   # Project coding standards
│   └── modules/                   # Feature-based modules (future use)
├── public/                        # Public assets
├── .husky/                        # Git hooks for quality assurance
├── .vscode/                       # VS Code workspace settings
├── package.json                   # Dependencies and scripts
├── vite.config.ts                 # Vite configuration (optimized)
├── tsconfig.app.json              # TypeScript config (performance optimized)
├── vitest.config.ts               # Vitest configuration
├── env.example                    # Environment variables template
└── README.md                     # This file
```

### 📏 **File Structure Rules:**

- **Maximum 200 lines per file** (preferably 150-180 lines)
- **Single responsibility** - each file demonstrates one concept
- **Clean imports** - minimal dependencies
- **Clear naming** - descriptive file names
- **Examples folder** - contains focused, reusable example components

### 📝 File Naming Convention

The project follows a consistent naming convention for different file types:

- **Components**: `.component.ts` (e.g., `login.component.ts`, `dashboard.component.ts`)
- **Services**: `.service.ts` (e.g., `auth.service.ts`, `patient.service.ts`)
- **Hooks**: `.hook.ts` (e.g., `auth.hook.ts`, `patient.hook.ts`)
- **Types**: `.types.ts` (e.g., `auth.types.ts`, `patient.types.ts`)
- **Reducers**: `.reducer.ts` (e.g., `auth.reducer.ts`, `patient.reducer.ts`)
- **Utilities**: `.util.ts` (e.g., `storage.util.ts`, `validation.util.ts`)
- **Constants**: `.constant.ts` (e.g., `api.constant.ts`, `routes.constant.ts`)

### 🏗️ Module Structure

Each module follows a consistent structure and can include sub-modules for complex features:

```
modules/
├── [feature-name]/                    # Main feature module
│   ├── [feature-name].component.ts    # Main component
│   ├── [feature-name].service.ts      # Business logic
│   ├── [feature-name].hook.ts         # Custom hooks
│   ├── [feature-name].types.ts        # Type definitions
│   ├── [feature-name].constant.ts     # Module constants
│   ├── [feature-name].util.ts         # Module utilities
│   ├── [feature-name].test.ts         # Module tests
│   └── [sub-feature]/                 # Sub-module for complex features
│       ├── [sub-feature].component.ts # Sub-feature component
│       ├── [sub-feature].service.ts   # Sub-feature service
│       ├── [sub-feature].hook.ts      # Sub-feature hooks
│       └── [sub-feature].types.ts     # Sub-feature types
└── [another-feature]/                 # Another main feature
    ├── [another-feature].component.ts
    ├── [another-feature].service.ts
    └── [another-feature].types.ts
```

**Example Structure:**

```
modules/
├── auth/                              # Authentication module
│   ├── auth.component.ts              # Main auth component
│   ├── auth.service.ts                # Auth service
│   ├── auth.hook.ts                   # Auth hooks
│   ├── auth.types.ts                  # Auth types
│   ├── login/                         # Login sub-module
│   │   ├── login.component.ts         # Login component
│   │   ├── login.service.ts           # Login service
│   │   └── login.types.ts             # Login types
│   └── register/                      # Register sub-module
│       ├── register.component.ts      # Register component
│       └── register.service.ts        # Register service
└── patients/                          # Patients module
    ├── patients.component.ts          # Main patients component
    ├── patients.service.ts            # Patients service
    ├── patients.types.ts              # Patients types
    ├── list/                          # Patient list sub-module
    │   ├── patient-list.component.ts  # List component
    │   └── patient-list.hook.ts       # List hooks
    └── details/                       # Patient details sub-module
        ├── patient-details.component.ts # Details component
        └── patient-details.service.ts   # Details service
```

## 🚀 Build Optimizations

- **Target**: ES2020 for modern browsers
- **Minification**: ESBuild with aggressive optimization
- **Code Splitting**: Vendor chunks separated
- **Source Maps**: Disabled in production
- **TypeScript**: Incremental builds with strict mode
- **Bundle Analysis**: Visual reports with `yarn analyze`

## 🧪 Testing

### Coverage Requirements

- **Statements**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Lines**: 100%

### Test Commands

```bash
# Run all tests with coverage
yarn test:coverage

# Interactive testing
yarn test:ui

# Watch mode for development
yarn test:watch
```

### Test Structure

- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and state management
- **E2E Tests**: [Future implementation]

## 🔒 Code Quality

### ESLint Rules

- **No Console**: Prevents console.log in production
- **TypeScript Strict**: Full type safety
- **React Best Practices**: Hooks and component rules
- **Prettier Integration**: Consistent formatting

### Web API Usage

**⚠️ IMPORTANT: Never use web APIs directly in your code!**

Always use the utility functions and services provided by the project. This includes but is not limited to:

- **localStorage/sessionStorage** - Use storage utilities
- **fetch/XMLHttpRequest** - Use HTTP service
- **cookies** - Use cookie utilities
- **IndexedDB** - Use database utilities
- **WebSocket** - Use WebSocket service
- **File API** - Use file handling utilities
- **Geolocation API** - Use location service
- **Notification API** - Use notification service

**Storage Management Example:**

Always use the storage utility functions from `src/utils/storage.ts`:

```typescript
// ❌ WRONG - Don't do this
localStorage.setItem('auth_token', token);
const token = localStorage.getItem('auth_token');
sessionStorage.setItem('user_data', JSON.stringify(user));

// ✅ CORRECT - Use storage utility
import { storage } from '../utils/storage';
storage.setAuthToken(token);
const token = storage.getAuthToken();
storage.setUserData(user);
```

**HTTP Requests Example:**

```typescript
// ❌ WRONG - Don't do this
fetch('/api/users')
  .then(response => response.json())
  .then(data => console.log(data));

// ✅ CORRECT - Use HTTP service
import { useHttp } from '../hooks/useHttp';
const { get, data, loading, error } = useHttp();
await get('/api/users');
```

**Available Storage Functions:**

- `storage.getAuthToken()` - Get authentication token
- `storage.setAuthToken(token)` - Set authentication token
- `storage.clearAuthToken()` - Clear all auth tokens
- `storage.get(key)` - Generic getter
- `storage.set(key, value)` - Generic setter
- `storage.remove(key)` - Remove specific key
- `storage.clear()` - Clear all storage
- `storage.setUserData(user)` - Set user data
- `storage.getUserData()` - Get user data

### Prettier Configuration

- **Semi**: Always
- **Single Quotes**: Yes
- **Tab Width**: 2 spaces
- **Print Width**: 80 characters
- **Trailing Comma**: ES5

## 🚀 Performance Best Practices

### React Optimization

- **Memo**: Used for expensive components
- **useCallback**: Prevents unnecessary re-renders
- **Bundle Analysis**: Regular bundle size monitoring

### Mobile-First Design Principles

Since this app is for health workers who may use tablets and mobile devices:

- **Responsive Design**: Mobile-first approach with progressive enhancement
- **Touch-Friendly**: Minimum 44px touch targets for buttons and interactive elements
- **Gesture Support**: Swipe gestures for navigation and actions
- **Fast Loading**: Optimized for slower network conditions in rural areas

### HTTP Service & Hooks

The project includes a centralized HTTP service with custom hooks for API calls:

**HTTP Service (`src/services/http.ts`):**

- Axios-based with interceptors
- Automatic auth token handling
- Error handling for 401 responses
- TypeScript support

**Custom Hooks (`src/hooks/useHttp.ts`):**

- `useHttp<T>()` - General HTTP operations with loading/error states
- Built-in state management for requests
- Type-safe API calls

**API Service (`src/services/api.ts`):**

- Predefined endpoints for common operations
- Simple function-based approach
- No complex class hierarchies

**Usage Example:**

```typescript
import { useHttp } from '../hooks/useHttp';
import { apiService } from '../services/api';

function MyComponent() {
  const { get, data, loading, error } = useHttp();

  const fetchData = async () => {
    await get('/api/endpoint');
  };

  // Or use predefined API functions
  const handleLogin = async () => {
    await apiService.login({ email, password });
  };
}
```

## 📈 Monitoring & Analytics

- **Development**: Hot Module Replacement, Bundle Analyzer, TypeScript checking
- **Production**: Bundle analysis, performance metrics, error tracking (Sentry)
- **Quality**: ESLint + Prettier + Husky pre-commit hooks

## 🌿 GitHub Branch Strategy

### Branch Structure

Our project follows a **4-branch strategy** with clear separation of concerns:

```
main (production)
  ↑
staging (pre-production)
  ↑
qa (quality assurance)
  ↑
dev (development)
```

### Branch Purposes

- **`main`** - Production-ready code, stable releases only
- **`staging`** - Pre-production environment, final testing before production
- **`qa`** - Quality assurance branch, testing and validation
- **`dev`** - Development branch, anyone can push for testing

### Branch Flow Rules

1. **Development Flow**:
   - Devs cut branches from `qa` for development
   - Anyone can push directly to `dev` for testing
   - `dev` is used for development server testing

2. **QA Process**:
   - Feature branches are merged to `dev` for dev server testing
   - **Same feature branch** is then merged to `qa` for QA testing
   - **CRITICAL**: `dev` branch NEVER merges directly into `qa`
   - Only individual feature branches merge to `qa`

3. **Deployment Flow**:
   - `qa` → `staging` → `main` (sequential promotion)
   - **CRITICAL**: `dev` can NEVER merge directly into `qa`
   - All production deployments must go through the proper QA process

### Branch Naming Conventions

Follow these naming patterns for all feature branches:

#### Feature Branches

```
feature/<PROJECT_SHORT_CODE>_<feature-name>
feature/<feature-name>                    # For general features
```

**Examples:**

- `feature/NAS_patient-registration` # for example: If it's NAS specific
- `feature/dashboard-patient-list`
- `feature/auth-login-flow`
- `feature/reports-export`

#### Bug Fix Branches

```
fix/<fix-details-in-short-n-specific>
```

**Examples:**

- `fix/login-validation-error`
- `fix/patient-search-performance`
- `fix/mobile-responsive-issues`

#### Hotfix Branches

```
hotfix/<fix-details-in-short-n-specific>
```

**Examples:**

- `hotfix/critical-security-patch`
- `hotfix/production-crash-fix`
- `hotfix/urgent-data-loss-prevention`

#### Patch Branches

```
patch/<patch-details>
```

**Examples:**

- `patch/update-dependencies`
- `patch/performance-optimization`
- `patch/accessibility-improvements`

#### Improvement Branches

```
improvements/<PROJECT_SHORT_CODE>_<improvement-details>
improvements/<improvement-details>        # For general improvements
```

**Examples:**

- `improvements/patient-ui-ux`
- `improvements/dashboard-performance`
- `improvements/mobile-navigation`

### Branch Workflow Examples

#### Feature Development

```bash
# 1. Devs cut branch from QA for development
git checkout qa
git pull origin qa
git checkout -b feature/patient-registration

# 2. Develop on the branch
# ... make changes ...
git add .
git commit -m "feat: implement patient registration"
git push origin feature/patient-registration

# 3. Merge branch to dev for testing on dev server
git checkout dev
git merge feature/patient-registration
git push origin dev
# ... test on dev server ...

# 4. Merge same branch to qa for QA testing (NOT dev to qa!)
git checkout qa
git merge feature/patient-registration
git push origin qa
# ... QA testing the ticket ...

# 5. Once QA approved, merge qa branch to staging
git checkout staging
git merge qa
git push origin staging
# ... staging testing ...

# 6. Finally, merge staging to main for production
git checkout main
git merge staging
git push origin main
```

#### Hotfix Process

```bash
# 1. Start from main (production issue)
git checkout main
git pull origin main

# 2. Create hotfix branch
git checkout -b hotfix/critical-security-patch

# 3. Fix the issue
# ... make changes ...

# 4. Test and merge to main
git checkout main
git merge hotfix/critical-security-patch
git push origin main

# 5. Also merge to dev, qa and staging to keep them updated
git checkout dev
git merge hotfix/critical-security-patch
git push origin dev

git checkout qa
git merge hotfix/critical-security-patch
git push origin qa

git checkout staging
git merge hotfix/critical-security-patch
git push origin staging
```

### Branch Protection Rules

- **`main`**: Requires pull request, code review, passing tests, and can only be merged by code owners or repo admins
- **`staging`**: Requires pull request, passing tests, and can only be merged by code owners or repo admins
- **`qa`**: Requires pull request, passing tests, and can only be merged by code owners or repo admins
- **`dev`**: No restrictions (anyone can push)

### Important Notes

- ⚠️ **NEVER** merge `dev` directly into `qa`
- ✅ Always create feature branches from `dev`
- ✅ QA must create branches from `dev` for testing
- ✅ Use descriptive branch names following the conventions
- ✅ Delete feature branches after merging
- ✅ Keep branch names short but descriptive

## 🤝 Contributing

- **Code Quality**: 100% test coverage required
- **Performance**: Bundle size limits enforced
- **Type Safety**: Strict TypeScript configuration
- **Formatting**: Prettier + ESLint auto-fix
- **Pre-commit**: All checks run automatically via Husky
- **Branch Strategy**: Follow the GitHub branch strategy outlined above

## 🚀 Deployment & CI/CD

### Deployment Overview

The project uses a standardized deployment pipeline across all environments (development, QA, staging, and production). All deployment workflows follow a consistent structure for reliability and maintainability.

### Deployment Environments

| Environment     | Branch    | Trigger                                               | Purpose                             |
| --------------- | --------- | ----------------------------------------------------- | ----------------------------------- |
| **Development** | `develop` | Push to develop                                       | Development testing and integration |
| **QA**          | `qa`      | Push to qa                                            | Quality assurance testing           |
| **Staging**     | `staging` | Push to staging                                       | Pre-production validation           |
| **Production**  | `main`    | Push to main, manual trigger, or successful PR checks | Live production deployment          |

### Standardized Deployment Pipeline

Each deployment follows these consistent steps:

1. **🔄 Checkout code** - Get the latest code from the repository
2. **⚙️ Setup Node.js** - Install Node.js 22.18.0 (consistent across all environments)
3. **📦 Install dependencies** - Install project dependencies with yarn
4. **🧪 Run tests** - Execute test suite with conditional coverage requirements
5. **📊 Analyze bundle** - Analyze bundle size and performance
6. **🔒 Security audit** - Run security audit for vulnerabilities
7. **🏗️ Build** - Build the application for the target environment
8. **🚀 Deploy** - Deploy to the target server
9. **📧 Notify** - Send deployment notifications

### Environment-Specific Configurations

While the pipeline structure is consistent, each environment has specific configurations:

#### Development

- **Environment**: `VITE_APP_ENV=development`
- **Debug Mode**: Enabled (`VITE_DEBUG_MODE=true`)
- **Coverage**: Conditional (can be bypassed with `BYPASS_COVERAGE_CHECK`)
- **Security Audit**: High-level vulnerabilities only

#### QA

- **Environment**: `VITE_APP_ENV=qa`
- **Coverage**: Required (100%)
- **Security Audit**: High-level vulnerabilities
- **Additional**: E2E tests and QA team notifications

#### Staging

- **Environment**: `VITE_APP_ENV=staging`
- **Coverage**: Required (100%)
- **Security Audit**: Comprehensive audit
- **Additional**: Smoke tests and stakeholder notifications

#### Production

- **Environment**: `VITE_APP_ENV=production`
- **Coverage**: Required (100%)
- **Security Audit**: High-level vulnerabilities
- **Additional**: Release tagging, GitHub releases, and comprehensive notifications

### Deployment Validation

Use the validation script to ensure all deployment configurations are consistent:

```bash
# Run deployment validation
./scripts/validate-deployments.sh

# Make script executable (if needed)
chmod +x scripts/validate-deployments.sh
```

The validation script checks:

- ✅ YAML syntax and structure
- ✅ Required fields and environment variables
- ✅ Step consistency across environments
- ✅ Node.js version consistency
- ✅ Absence of commented-out code

### Manual Deployment Commands

```bash
# Build for specific environment
VITE_APP_ENV=development yarn build  # Development
VITE_APP_ENV=qa yarn build           # QA
VITE_APP_ENV=staging yarn build      # Staging
VITE_APP_ENV=production yarn build   # Production

# Bundle analysis (generates dist/stats.html)
yarn analyze

# Security audit
yarn audit --audit-level high

# Verify bundle size
ls -la dist/assets/
```

### Deployment Checklist

Before deploying to any environment, ensure:

- [ ] All required environment variables are configured
- [ ] Tests are passing (coverage requirements met)
- [ ] Security audit passes
- [ ] Bundle size is within acceptable limits
- [ ] Pre-commit checks are passing
- [ ] Target branch is up to date

### Troubleshooting Deployments

If deployment fails:

1. **Check the validation script**: `./scripts/validate-deployments.sh`
2. **Verify environment secrets**: Ensure all required secrets are configured
3. **Review workflow logs**: Check GitHub Actions logs for specific errors
4. **Test locally**: Run the build and test commands locally
5. **Check server connectivity**: Ensure SSH keys and server access are working

## 📚 Additional Resources

- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Testing Guide](https://vitest.dev/)

## 📞 Support

For technical support or questions, please contact the **webapp team lead**.

---

**Built with ❤️ and ☕ for healthcare workers**
