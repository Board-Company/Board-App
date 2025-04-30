## Frontend
To run:

```
cd nimbus
npm install --legacy-peer-deps
npx react-native run-android
```
To add a new package:

```
npm install <package-name> --legacy-peer-deps

```
To clear Cache: 

```
npx react-native start --reset-cache
```
*note to run, this must be done user legacy peer deps or there will be errors
## Backend Server

To run the backend server using Poetry:

```
# Navigate to the backend directory
cd backend

# Install dependencies (first time only)
poetry install


# Run the server
poetry run python api.py 
```

The backend server provides API endpoints for:
- User authentication and management
- Data storage and retrieval
- Real-time notifications
- Integration with external services

Make sure the backend server is running before launching the mobile application to ensure all features work correctly.

