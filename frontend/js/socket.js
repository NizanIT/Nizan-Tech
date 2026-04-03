// Socket.IO client setup
// Include socket.io from CDN in HTML pages that need it

let socket = null;

const initSocket = (userId, role) => {
  socket = io('https://nizan-tech.onrender.com');

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    socket.emit('join', userId);
    if (role === 'admin') socket.emit('joinAdmin');
  });

  socket.on('disconnect', () => console.log('❌ Socket disconnected'));

  return socket;
};

const getSocket = () => socket;
