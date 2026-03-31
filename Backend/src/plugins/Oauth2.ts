import { FastifyInstance, FastifyPluginOptions} from "fastify"
import fp from 'fastify-plugin'
import oauth2 from '@fastify/oauth2'
import cookie from '@fastify/cookie'

interface userType{
    username: string;
    id:string | number
	Avatar: string;
    oauth_name: number;
    email: string;

}

async function oauth2_plugin(fastify:FastifyInstance, opts:FastifyPluginOptions)
{
    const id_ = process.env.google_client_id;
    const secret_ = process.env.google_client_secret;
    if (!id_ || !secret_)
        throw new Error("Missing cridenntials");

    const max_age_acc = process.env.access_token_max_age;
    const exp_acc = process.env.expire_at_acc;
    const max_age_ref = process.env.refresh_token_max_age;
    const exp_ref = process.env.expire_at_ref
    if (!max_age_acc || !max_age_ref || !exp_acc || !exp_ref)
        throw new Error("Missing cridenntials");
    const max_acc_val = Number(max_age_acc);
    const max_ref_val = Number(max_age_ref);
    if (isNaN(max_acc_val) || isNaN(max_ref_val))
        throw new Error("not a valid value");
    let name_ = ''
    fastify.register(cookie);
    fastify.register(oauth2, {
      name: "googleOAuth2",
      credentials: {
        client: {
            id: String(id_),
            secret: String(secret_)
        },
        auth: oauth2.GOOGLE_CONFIGURATION
    },
    startRedirectPath: "/api/login/google",
    callbackUri: 'https://localhost:3000/api/login/google/callback',
    scope: ['email', 'profile']
    });
    fastify.get('/api/login/google/callback', async function (request, reply){
        try{
            const {token} = await fastify.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);

            const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${token.access_token}`}
            });
		    const {email, given_name, picture} = await res.json();

            const get_user = fastify.db.prepare("SELECT * FROM users WHERE email = ? ").get(email) as userType | undefined
            if (get_user)
            {
                if (get_user.Avatar[0] !== '/')
                    fastify.db.prepare("UPDATE users SET Avatar = ? WHERE email = ? ").run( picture, email)
                if (get_user.oauth_name === 0)
                    {
                        name_ = given_name;
                        const name = fastify.db.prepare("SELECT * FROM users WHERE username = ? ").get(name_) as userType | undefined;
                        if (name?.email !== email && name?.oauth_name === 0)
                        {
                            name_ = '_' + name?.username;    
                            fastify.db.prepare("UPDATE users SET username = ? WHERE email = ? ").run(name_, email)
                        }
                        else
                        {
                            const cleanName = given_name.replace(/[^\w]/g, '_');
                            fastify.db.prepare("UPDATE users SET username = ? WHERE email = ? ").run(cleanName, email)
                        }
                    }
                    const load = {"sub":get_user.id, "name":name_};
                    const accessToken = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
                    const refreshToken = fastify.jwt.sign(load, {expiresIn: String(exp_ref)});
                    fastify.db.prepare("UPDATE users SET token = ? WHERE email = ? ").run(refreshToken, email)

                    reply.setCookie('access_token', accessToken, {
                        path:'/',
                        httpOnly: true,
                        sameSite:'lax',
                        maxAge: Number(max_age_acc)
                    })
    
                    reply.setCookie('refresh_token', refreshToken, {
                        path:'/api/user/refresh',
                        httpOnly: true,
                        sameSite:'lax',
                        maxAge: Number(max_ref_val)
                    })
                return reply.redirect('https://localhost:3000/user_profile');
            }
            const salt = await fastify.crypt_pass.getSalt();
            const insert = fastify.db.prepare(`INSERT INTO users (username, password, email, salt, token, twoFactorCode, ResetCode, usedCode, twoFA, Avatar, oauth2, oauth_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`  
            ).run(null, null, email, salt, null, null, null, 0, 0, picture, 1, 0);
            const user = fastify.db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
            if (!user)
                return reply.redirect('https://localhost:3000/signin');
            
            let username:string;
            const cleanName = given_name.replace(/[^\w]/g, '_');
            const get_name = fastify.db.prepare('SELECT * FROM users WHERE username = ?').get(cleanName) as any;
            if (get_name)
            {
                name_ = '_' + get_name.username

                fastify.db.prepare('UPDATE users SET username=?, oauth_name = ? WHERE email =? ').run(name_, 1, email);
            }
            else
            {
                username = cleanName;
                fastify.db.prepare('UPDATE users SET username=? WHERE email =? ').run(username, email);
            }
            const load = {"sub":user.id, "name":name_};

            const accessToken_ = fastify.jwt.sign(load, {expiresIn: String(exp_acc)});
            const refreshToken_ = fastify.jwt.sign(load, {expiresIn: String(exp_ref)});

            fastify.db.prepare("UPDATE users SET token = ? WHERE email = ?").run(refreshToken_,email);

                reply.setCookie('access_token', accessToken_, {
                    path:'/',
                    httpOnly: true,
                    sameSite:'lax',
                    maxAge: Number(max_acc_val)
                })

                reply.setCookie('refresh_token', refreshToken_, {
                    path:'/api/user/refresh',
                    httpOnly: true,
                    sameSite:'lax',
                    maxAge: Number(max_ref_val)
                })


         return reply.redirect('https://localhost:3000/user_profile')

        }catch(error){
            return reply.redirect('https://localhost:3000/signin');
        }
    })
}

export default fp(oauth2_plugin, {
    name: "oauth_two"
})
