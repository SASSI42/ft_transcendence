import 'fastify'
import Database from 'better-sqlite3'
import { Multipart } from '@fastify/multipart';
import { Transporter, SendMailOptions, SentMessageInfo } from 'nodemailer';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database

    crypt_pass:{
        getSalt: () => Promise<string>;
        getHash: (password:string, salt:string) => Promise<string>;
        verify_pass: (hashPassword:string, password:string, salt:string) => Promise<boolean>;
    }
    jwtUtil:{
        getToken: (payload:object) => any;
        verifyToken: (token:string) => any;
    }
    mailer:{
      sendMail: (mailOptions: nodemailer.SendMailOptions) => Promise<SentMessageInfo>;
    }
    randomPass:{
      genSecPass:(minLength:number, maxLength:number) => Promise<string>
    }
    randomCode:{
      genCode:(minLength:number, maxLength:number) => Promise<string>
    }
  }
    interface FastifyRequest {
    file(): Promise<Multipart>;
  }
  interface FastifyInstance {
    googleOAuth2: any;
  }
  interface FastifyInstance {
    helmet: any;
  }
}
