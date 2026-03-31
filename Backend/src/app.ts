import Fastify from 'fastify'
import myPlugin from './plugins/plugin'
import data_base from './plugins/data_base'
import signIN from './plugins/signIn'
import signUP from './plugins/signUp'
import encryption from './plugins/hasher'
import jwt from '@fastify/jwt';
import cors from '@fastify/cors'
import update_username from './plugins/update_username'
import update_password from './plugins/update_password'
import update_email from './plugins/update_email'
import serverUploads from './plugins/serveUploads'
import forgot_password from './plugins/forgot_password'
import codeGenerator from './plugins/generateCode'
import nodemailerTransporter from './plugins/transporter'
import  twoFactor from './plugins/twoFactor'
import update_avatar from './plugins/update_avatar'
import oauth2_plugin from './plugins/Oauth2'
import twoFactorHandler from './plugins/twoFactorHandler'
import login from './plugins/login'
import reset_password from './plugins/reset_password'
import user_profile from './plugins/user_profile'
import user_profile_id from './plugins/user_profile_id'
import tfa_activator from './plugins/two_fa_activator'


import { Server } from 'socket.io';
import { setupSocketHandlers } from './socket/handlers';
import { friendsRoutes } from './routes/friends';
import { messagesRoutes } from './routes/messages';
import { authMiddleware } from './middleware/auth';
import { socketAuthMiddleware } from './middleware/socketAuth';
import metrics from 'fastify-metrics';


const server = Fastify({
  trustProxy: true,
  logger: {
    level: 'info',
    transport: {
      target: "pino-socket",
      options: {
        address: 'logstash',
        port: 5000,
        mode: 'tcp',
        reconnect:{
          retries: 5,
          factor: 2
        }
      }
    }
  }
});

server.register(metrics, { endpoint: '/metrics' });

const start = async () => {
  const jwt_secret = process.env.jwt_secret;
  if (!jwt_secret)
    throw new Error("Missing cridenntials");
  try {
    await server.register(cors, {
      origin: true, 
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true})
    
    await server.register(jwt, {
        secret: String(jwt_secret),
        cookie: {
            cookieName: 'access_token',
            signed: false
        }
    })
    await server.register(data_base);
    await server.register(user_profile);
    await server.register(user_profile_id);
    await server.register(tfa_activator);
    await server.register(myPlugin);
    await server.register(signUP);
    await server.register(update_password);
    await server.register(codeGenerator);
    await server.register(nodemailerTransporter);
    await server.register(update_username);
    await server.register(twoFactorHandler);
    await server.register(oauth2_plugin);
    await server.register(update_avatar);
    await server.register(forgot_password);
    await server.register(reset_password);
    await server.register(serverUploads);
    await server.register(twoFactor);
    await server.register(update_email);
    await server.register(login);
    await server.register(signIN);
    await server.register(encryption);

    server.register(async (protectedApi) => {
        protectedApi.addHook('onRequest', authMiddleware);

        protectedApi.register(friendsRoutes, { prefix: '/api' });
        protectedApi.register(messagesRoutes, { prefix: '/api' });
      });
      
    await server.ready();
    server.server.listen({ port: 4000, host: '0.0.0.0' }, () => {
        console.log(`Server is running`);
    });

    const io = new Server(server.server, {
        cors: {
            origin: true,
            credentials: true
        },
        pingInterval: 2000, 
        pingTimeout: 5000,
    });

    io.use(socketAuthMiddleware(server));
    

    setupSocketHandlers(server.db, io);


  } catch (err){
    server.log.error(err)
    process.exit(1)}
}
start();