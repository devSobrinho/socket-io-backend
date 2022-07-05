import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { generateId } from './utils/generateId';

import 'reflect-metadata';

const app = express()

const server = createServer(app)

interface IUser {
  id: string;
  name: string;
}

interface IMessage {
  id: string;
  message: string;
  user: IUser;
  date: Date;
}

type IMessageDate = {
  roomId: string;
} & Omit<IMessage, "date">

type IRoomDate = {
  roomId: string;
  user: IUser;
}

interface IRoom {
  id: string;
  name: string;
  maxConnection: number;
  roomPrivate: boolean;
  password?: string;
  userAdmin: IUser;
  usersConnect: IUser[];
  message: IMessage[];
}

interface ICreateRoom {
  id: string;
  name: string;
  maxConnection: number;
  roomPrivate: boolean;
  password?: string;
  userAdmin: IUser;
};

type ISelectRoom = {
  user: IUser;
} & Pick<IRoom, "id"> & Pick<IRoom, "password">



const io = new Server(server, {
  cors: {
    origin: "",
    methods: ["GET", "POST"]
  }
})

function getUserRoom(userId: string, room: IRoom) {
  return room.usersConnect.find(userRoom => userRoom.id === userId);
}

function getRoom(roomId: string, rooms: IRoom[]) {
  return rooms.find(room => room.id === roomId);
}

function passwordRoomToEqual(password: string, room: IRoom) {
  return room.password === password
}

function disconnectUserRoom(userId: string, room: IRoom) {
  const userIndex = room.usersConnect.findIndex(userRoom => userRoom.id === userId);
  room.usersConnect.splice(userIndex, 1);
}

const rooms: IRoom[] = [ //obj em memoria
  // {
  //   id: "sala1",
  //   maxConnection: 3,
  //   roomPrivate: false,
  //   name: "teste",
  //   password: "",
  //   userAdmin: {
  //     name: "Jurandir",
  //     id: "1234"
  //   },
  //   usersConnect: [],
  //   message: []
  // }
];

io.on("connection", async (socket) => {

  console.log('socket is run');
  
  socket.on("create_room", ({name, maxConnection, roomPrivate, password, userAdmin}: ICreateRoom) =>{
    //validation
    if(!name || maxConnection < 2 || maxConnection > 10 || !userAdmin) return;

    const id = generateId();

    rooms.push({
      id,
      maxConnection,
      roomPrivate: roomPrivate ?? false,
      name,
      password,
      message: [],
      userAdmin,
      usersConnect: [],
    }); 
    console.log('rooms', rooms);
    const roomsEmmitGlobal = rooms.map(room => ({
      id: room.id,
      maxConnection: Number(room.maxConnection),
      name: room.name,
      roomPrivate: room.roomPrivate,
      userAdmin: room.userAdmin.id,
      usersConnected: room.usersConnect.length,
  }));
  
    socket.broadcast.emit("rooms", {
      teste: "a rom",
      rooms: roomsEmmitGlobal
    });
  });



  socket.on("select_room", ({id, password, user}: ISelectRoom) =>{
    if(!id || !user) {
      return socket.emit("select_room_message", {
        message: "Dados invalidos",
        status: 400
      });
    }
  
    const room = getRoom(id, rooms)  ; 
    if(!room) {
      return socket.emit("select_room_message", {
        message: "Sala não existe",
        status: 404
      });
    }

    const permission = room.password ? passwordRoomToEqual(password ?? "", room) : true;

    if(!permission) {
      return socket.emit("select_room_message", {
        message: "Senha incorreta",
        status: 403,
      });
    }

    const userExist = getUserRoom(user.id, room);
    if(userExist) {
      return socket.emit("select_room_message", {
        message: "Usuario ja esta ma sala",
        status: 200
      });
    }

    room.usersConnect.push(user)

    socket.emit("select_room_message", {
      message: "loading",
      status: 200,
    });
  });

  socket.on("messages_room", ({ roomId, user }: IRoomDate) => {

    const room = getRoom(roomId, rooms);
    if(!room) return;

    const userRoom = getUserRoom(user.id, room);
    if(!userRoom) return;
    const isAdmin = room.userAdmin.id === user.id;

    socket.emit("messages_room_response", {
      messages: room.message,
      isAdmin
    });
  });

  // tenho que validar o user
  socket.on("create_message_room", ({user, message, roomId}: IMessageDate) =>{
    console.log("message", user ,message, roomId);
    if(!user || !message ||!roomId) return;

    const room = getRoom(roomId, rooms);
    if(!room) {
      return socket.emit("message_error", {
        message: "Ops...Sala não encontrada"
      });
    }

    const userRoom = getUserRoom(user.id, room);
    if(!userRoom) {
      return socket.emit("message_error", {
        message: "Usuario não esta na sala",
      })
    }
    console.log('messege send');

    room.message.push({
      message,
      user,
      id: `${generateId()}-${user.id}`,
      date: new Date(),
    });  
  })

  socket.on("disconnect_room", ({user, roomId}: IRoomDate) => {
    const room = rooms.find(room => room.id === roomId);
    if(!room) return;

    disconnectUserRoom(user.id, room);

    const tes = rooms.map(room => ({
      id: room.id,
      maxConnection: Number(room.maxConnection),
      name: room.name,
      roomPrivate: room.roomPrivate,
      userAdmin: room.userAdmin.id,
      usersConnected: room.usersConnect.length,
    }));
    
    socket.broadcast.emit("rooms", {
      teste: "a rom",
      rooms: tes
    });
  })

  socket.on("delete_room",(data) => {
    console.log('data', data);
  })

  socket.on("rooms_resquest", () => {
    const roomsEmit = rooms.map(room => ({
      id: room.id,
      maxConnection: Number(room.maxConnection),
      name: room.name,
      roomPrivate: room.roomPrivate,
      userAdmin: room.userAdmin.id,
      usersConnected: room.usersConnect.length,
    }));
    console.log('meu roomsEmit', roomsEmit);

    socket.broadcast.emit("rooms", {
      teste: "a rom",
      rooms: roomsEmit
    });
  })
})


server.listen(8000);
