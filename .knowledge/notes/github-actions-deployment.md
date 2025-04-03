## [2023-04-02 12:45] GitHub Actions Deployment Workflow Implementation

### Overview
Implemented a CI/CD deployment workflow for FragmentProxyBackend using GitHub Actions. The workflow was modeled after an existing TelegramBot deployment configuration and adapted for this Node.js/TypeScript project.

### Key Components

#### Workflow Trigger
- Configured to trigger on pushes to the `main` branch
- Added concurrency setting to cancel in-progress deployments when new ones are initiated

#### Environment Setup
- Using Ubuntu latest runner
- Node.js 18 with Yarn package manager
- Caching dependencies to speed up builds

#### Deployment Process
1. **Build Phase**:
   - Checkout code with full history
   - Set up Node.js environment
   - Install dependencies using Yarn with frozen lockfile for consistency
   - Build TypeScript code

2. **Deployment Preparation**:
   - Install sshpass for non-interactive SSH authentication
   - Create .env file from GitHub secrets
   - Package required files (dist, package.json, yarn.lock, .env) into a tar archive

3. **Server Setup Script**:
   - Checks and installs required dependencies (Node.js, Yarn)
   - Creates application directory at /opt/fragment-proxy

4. **Deployment Script**:
   - Handles process management (stops existing processes)
   - Extracts application files to server
   - Installs production dependencies
   - Creates systemd service for reliable process management
   - Starts and enables the service
   - Verifies successful deployment

### Security Considerations
- Credentials stored as GitHub secrets:
  - SERVER_SSH_PASSWORD
  - SERVER_HOST
  - SERVER_SSH_PORT (optional, defaults to 22)
  - ENV_FILE_CONTENT (complete .env file content)

### Improvements Over TelegramBot Deployment
1. Uses systemd for process management instead of nohup
2. Creates a proper system service with automatic restart capabilities
3. Includes SSH port configuration option
4. Optimizes for Node.js/TypeScript environment vs Python
5. Uses yarn with frozen lockfile for dependency consistency

### Required GitHub Repository Setup
To use this workflow, repository secrets need to be configured:
- SERVER_SSH_PASSWORD: SSH password for root access
- SERVER_HOST: Hostname/IP of the deployment server
- SERVER_SSH_PORT: (Optional) SSH port if not default 22
- ENV_FILE_CONTENT: Complete content of the .env file with all required variables

### Testing Notes
The workflow has been implemented but requires testing after repository secrets are configured.

## [2023-04-03 15:30] Deployment Workflow Improvements

### Issues Fixed
1. **Server OS Compatibility**: 
   - Changed package management from `apt-get` (Debian/Ubuntu) to `yum` (RHEL/CentOS/Fedora)
   - Updated Node.js setup script to use RPM-based installation

2. **Service Configuration**:
   - Corrected the ExecStart path from `/opt/fragment-proxy/index.js` to `/opt/fragment-proxy/program.js`
   - This matches the actual entry point for the application as used in local development

### Testing Status
- Initial deployment attempt encountered errors with package management commands
- Fixed issues and prepared for next deployment test 

## [2023-04-03 16:30] Node.js Version Downgrade for CentOS 7

### Issues Fixed
1. **Node.js Compatibility with CentOS 7**:
   - Downgraded Node.js from version 18.x to 16.x for compatibility with CentOS 7's older glibc (2.17)
   - Updated both GitHub Actions runner and server installation to use Node.js 16.x

### Technical Context
- CentOS 7 ships with glibc 2.17, which is too old for Node.js 18.x (requires glibc 2.28)
- Node.js 16.x is the newest LTS version compatible with CentOS 7's system libraries
- While local development uses Node.js 23.9.0, deployment must use 16.x on the server

### Testing Status
- Previous deployment attempt failed due to incompatible glibc version
- Updated configuration should resolve the dependency issues

## [2023-04-03 17:00] Upgrading Node.js Using NVM

### Approach Change
After realizing that Node.js 16.x might be too old for the codebase (development uses Node.js 23.9.0), we've changed the deployment strategy to use NVM (Node Version Manager) instead of system packages.

### Technical Solution
1. **NVM Installation**:
   - Install NVM directly on the server
   - Use NVM to install Node.js 18 without relying on system libraries (glibc)
   - Configure .bashrc for NVM autoloading

2. **Service Configuration Updates**:
   - Modified systemd service to use NVM-managed Node.js
   - Changed ExecStart to source NVM before executing node
   - Added explicit service stop before deployment

### Advantages
- Allows using newer Node.js versions without upgrading the entire OS
- Provides flexibility to easily change Node.js versions if needed
- Resolves compatibility issues without code modifications
- Maintains closer parity between development and production environments

### Security Consideration
- NVM installation pulls scripts from GitHub, requiring outbound internet access from the server
- Uses the official NVM installation script with proper verification

## [2023-04-03 17:30] Node.js 14 for CentOS 7 Compatibility

### Issues Fixed
1. **NVM Node.js Binary Compatibility**:
   - Further downgraded Node.js from version 18.x to 14.x
   - Despite using NVM, the Node.js 18 binary still requires newer system libraries

### Technical Context
- Even when using NVM, the Node.js binary itself has system library dependencies
- Node.js 14.x is the last LTS version with good compatibility for CentOS 7's glibc 2.17
- The workflow now uses Node.js 14 for both building and running the application

### Expected Compatibility Challenges
- TypeScript features used in the codebase may need to be limited to those supported by Node.js 14
- Some npm packages may have minimum Node.js version requirements above 14
- Local development on Node.js 23.9.0 may use features not available in 14.x

### Next Steps
- If deployment with Node.js 14 is successful, evaluate if the application works correctly
- Consider adding compatibility tests in CI for Node.js 14
- Long-term, consider upgrading the server to a newer OS version or use containerization 