# chatter
![image](https://github.com/ashutoshsuthar2020/chatter/assets/77433155/c294bac9-23ad-4c52-8405-1776a7ba81bf)

Get started:

Enter your MongoDB link in connection.js under directory connections in the server folder.

Docker
```
  docker compose build
  docker compose up
```
Open two terminals and follow these commands:

```
cd client && npm install
npm run start
```
```
cd server && npm install
npm run dev
```

Technology Stack:
- MongoDB: Used as the database to store user profiles, chat messages, and other relevant data.
- Express.js: Acted as the server-side framework for handling HTTP requests and serving the React.js frontend.
- React.js: Developed the user interface (UI) for a responsive and interactive chat application using React components.
- Node.js: Ran the server-side code and managed the server for the application.
- Socket.io: Implemented real-time communication between users by enabling WebSocket connections.

User Authentication: implemented a user authentication system to allow users to create accounts, log in, and secure chat sessions.

Real-Time Chat: Utilized Socket.io to enable real-time chat functionality, allowing users to send and receive messages instantly without manual refreshing.

Message History: This application stores message history, allowing users to view previous messages and conversations.

Responsive Design: Ensured the application's user interface is responsive, making it accessible and visually appealing.

Future Enhancements: Consider potential future enhancements, such as group chat support, message encryption, multimedia sharing, and additional features to improve the user experience.
