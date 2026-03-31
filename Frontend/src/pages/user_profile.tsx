import {useNavigate, useParams } from 'react-router-dom';
import time_icon from '../assets/time_icon.svg';
import statistic_time from '../assets/statistic_icon.svg';
import getBackendUrl from '../api/getUrl';
import { useEffect, useState, useMemo} from 'react';
import default_avatar from '../assets/default_avatar.png'
import bg_pingpong from '../assets/Ping Pong Background.jpeg'
import bg_tictac from '../assets/Ultimate tic-tac-toe.png'
import { IoPodium } from "react-icons/io5";
import { FaHistory } from "react-icons/fa";


interface MachesProps{
  username1:string,
  username2:string,
  time:string | number,
  res1:string | number,
  res2:string | number,
  game:string,
  avatar1:string,
  avatar2:string,
  id1: number,
  id2: number
}

interface LeadersPorps{
  id: string | number
  username: string;
  score: string | number;
  avatar: string;
}

const Matches:React.FC<MachesProps> = ({username1, username2, time, res1, res2, game, avatar1, avatar2, id1, id2})=>
{
  const navigate = useNavigate();
  const fallbackImage = "https://ui-avatars.com/api/?name=User";
  return (
    <div className="w-full px-4 lg:px-6 ">
      <hr className='border-secondary/5' />
      <div className='flex flex-wrap items-center justify-evenly py-2 gap-2'>
        <p className='text-gray-400 text-xs text-center w-full'>{time}</p>
        <button className="group flex items-center gap-2 hover:text-teal-300 hover:scale-105" onClick={()=>{navigate(`/user_profile/${id1}`)}}>
          <span className='font-bold text-sm  ml-6 hover:text-teal-400'>{username1}</span>
          <img src={avatar1 || default_avatar}   
            crossOrigin='anonymous' 
            referrerPolicy='no-referrer' 
            alt="Profile1"
            onError={(e) => { e.currentTarget.src = fallbackImage }}
            className='bg-white rounded-full border-1 border-gray-500 w-10 h-10 group-hover:border-teal-300 mr-5'/>
        </button>
        <div>
        <span className={`font-bebas-neue text-2xl text-gray-300`}>{res1}</span>
        <span className='text-teal-300 text-2xl'> - </span>
        <span className={`font-bebas-neue text-2xl text-gray-300`}>{res2}</span>
        </div>
        <button className="group flex items-center gap-2 hover:text-teal-300 hover:scale-105" onClick={()=>{navigate(`/user_profile/${id2}`)}}>
          <img src={avatar2 || default_avatar}
            crossOrigin='anonymous' 
            referrerPolicy='no-referrer' 
            onError={(e) => { e.currentTarget.src = fallbackImage }}
            alt="Profile2"
          className='bg-white rounded-full border-1 border-gray-500 w-10 h-10 group-hover:border-teal-300'/>
          <span className='font-bold text-sm  mr-6 hover:text-teal-400'>{username2}</span>
        </button>
        {/* <p className='text-gray-400 text-xs'>{time}</p> */}
      </div>
    </div>
  )
}



const LeaderBoard:React.FC<LeadersPorps> = ({username, score, avatar, id})=>
{
    const fallbackImage = "https://ui-avatars.com/api/?name=User";

  const navigate = useNavigate();
  return(
      <div className='relative ml-6 font-bold text-primary'>
        <hr className='ml-8 border-secondary/10' />
        <button className="group flex items-center font-bold text-sm  mr-6 hover:text-teal-400" onClick={()=>navigate(`/user_profile/${id}`)}>
          <img 
            className='bg-white rounded-full border-1 border-gray-500 w-10 h-10 my-4 mr-4 inline-block transition-colors group-hover:border-teal-300' 
            src={avatar || default_avatar}
            crossOrigin='anonymous' 
            referrerPolicy='no-referrer' 
            onError={(e) => { e.currentTarget.src = fallbackImage }}
            alt="Profile"/> 
          <span>{username}</span>
          <p className='inline-block ml-5 mr-12 absolute right-0 text-h4'>{score}</p>
        </button>
      </div>
  )
}

interface GameStats_xo {
  total_xo: number,
  wins_xo: number,
  loses_xo: number,
  rate_xo: number,
  t_totale_xo: number,
  t_win_xo: number
}

interface GameStats {
  total: number,
  wins: number,
  loses: number,
  rate: number,
  t_totale: number,
  t_win: number
}


const UserProfile = () => {
  const [game, setGame] = useState<"pingpong" | "xo">("pingpong");
  const {id:ProfileId} = useParams();
  const [Avatar, setAvatar] = useState(default_avatar);
  const [stats, setData] = useState<GameStats>({
  total: 0,
  wins: 0,
  loses: 0,
  rate: 0,
  t_totale: 0,
  t_win: 0
  });
    const [stats_xo, setXoData] = useState<GameStats_xo>({
  total_xo: 0,
  wins_xo: 0,
  loses_xo: 0,
  rate_xo: 0,
  t_totale_xo: 0,
  t_win_xo: 0
  });
  const [username, setUsername] = useState('Loading...');
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [matchHistory_xo, setMatchHistory_xo] = useState<any[]>([]);
  const [Leaders, setLeaders] = useState<any[]>([]);
  const [Leaders_xo, setLeaders_xo] = useState<any[]>([]);


  useEffect(() => {
    const fetch_data = async () => {
      try{
        const end_point = ProfileId
        ? `${getBackendUrl()}:3000/api/user/user_profile/${ProfileId}`
        :`${getBackendUrl()}:3000/api/user/user_profile`
        let response = await fetch(end_point, {
          method:'GET',
          credentials: "include"
        });
        if (response.status === 401)
        {
            const refreshResponse = await fetch(`${getBackendUrl()}:3000/api/user/refresh`, {
              method: 'POST',
              credentials:'include'
          });
          if (refreshResponse.ok)
              response = await fetch(end_point, {
                  method: 'POST',
                  credentials:'include'});
          else
              throw new Error('Session expired. Please log in again.');
        }
        const res = await response.json();
        if (res && res.user_data)
          {
            setUsername(res.user_data.username);
            
            setMatchHistory(res.pong?.history || []);
            setMatchHistory_xo(res.xo?.history || []);
            setLeaders(res.pong?.leaders || []);
            setLeaders_xo(res.xo?.leaders || []);
            const total =  res.pong?.stats?.total || 0;
            const wins = res.pong?.stats?.wins || 0;
            const total_xo:number =  res.xo?.stats?.total || 0;
            const wins_xo:number = res.xo?.stats?.wins || 0;

            setData({
              total,
              wins,
              loses: total - wins,
              rate: total > 0 ? Math.round((wins / total) * 100): 0,
              t_totale: res.pong?.tournaments?.total_played || 0,
              t_win: res.pong?.tournaments?.total_won || 0
            });
            setXoData({
              total_xo,
              wins_xo,
              loses_xo: total_xo - wins_xo,
              rate_xo: total_xo > 0 ? Math.round((wins_xo / total_xo) * 100) : 0,
              t_totale_xo: res.tournaments?.total_played || 0,
              t_win_xo: res.tournaments?.total_won || 0
            });
            const AVATAR = res.user_data.Avatar;
            if (AVATAR && AVATAR[0] === '/')
              setAvatar(`${getBackendUrl()}:3000${AVATAR}`);
            else
              setAvatar(AVATAR);
          }
        }catch(err)
        {console.error("Error fetching user data:", err);}
        finally{}
      }
      fetch_data();
    }, [ProfileId])


  const fallbackImage = "https://ui-avatars.com/api/?name=User";
  const statsList = useMemo(() => [
    { index: 0, label: 'Matches played', val: stats.total },
    { index: 1, label: 'Matches won', val: stats.wins },
    { index: 2, label: 'Matches lost', val: stats.loses },
    { index: 3, label: 'Win Rate', val: `${stats.rate}%` },
    { index: 4, label: 'Tournaments played', val: stats.t_totale },
    { index: 5, label: 'Tournaments won', val: stats.t_win },
  ], [stats]);

    const statsList_xo = useMemo(() => [
    { index: 0, label: 'Matches played', val: stats_xo.total_xo },
    { index: 1, label: 'Matches won', val: stats_xo.wins_xo },
    { index: 2, label: 'Matches lost', val: stats_xo.loses_xo },
    { index: 3, label: 'Win Rate', val: `${stats_xo.rate_xo}%` },
  ], [stats]);
  
let gamestate = game == "pingpong" ? statsList : statsList_xo;
const t = matchHistory.map((t, i)=>{
  return <Matches key={i}
    id1={t.p1_id}
    id2={t.p2_id}
    username1={t.p1_username}
    username2={t.p2_username}
    time={new Date(t.created_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})}
    res1={t.p1_score}
    res2={t.p2_score}
    game={'PING-PONG'}
    avatar1={t.p1_avatar[0] === '/'?`${getBackendUrl()}:3000${t.p1_avatar}`:t.p1_avatar}
    avatar2={t.p2_avatar[0] === '/'?`${getBackendUrl()}:3000${t.p2_avatar}`:t.p2_avatar}
    />})

    const t_xo = matchHistory_xo.map((t, i)=>{
  return <Matches key={i}
    id1={t.p1_id}
    id2={t.p2_id}
    username1={t.p1_username}
    username2={t.p2_username}
    time={new Date(t.joined_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})}
    res1={t.p1_score}
    res2={t.p2_score}
    game={'TIC-TAC-TOE'}
    avatar1={t.p1_avatar[0] === '/'?`${getBackendUrl()}:3000${t.p1_avatar}`:t.p1_avatar}
    avatar2={t.p2_avatar[0] === '/'?`${getBackendUrl()}:3000${t.p2_avatar}`:t.p2_avatar}
    />})

const res = Leaders.map((t, i)=>{
  return(<LeaderBoard 
      key={i}
      id = {t.id}
      score={t.score}
      username={t.username}
      avatar={t.Avatar[0] === '/'?`${getBackendUrl()}:3000${t.Avatar}`:t.Avatar}/>)})

const res_xo = Leaders_xo.map((t, i)=>{
  return(<LeaderBoard 
      key={i}
      id = {t.id}
      score={t.score}
      username={t.username}
      avatar={t.Avatar[0] === '/'?`${getBackendUrl()}:3000${t.Avatar}`:t.Avatar}/>)})


  return (
        <div className='flex flex-col gap-5 relative overflow-auto h-full pt-5 px-4 sm:px-8 lg:px-12 xxl:px-24'>
          <div className='flex shrink-0 overflow-hidden rounded-3xl h-[180px] transition-all duration-500 ease-in-out' style={{ backgroundImage: `url(${ game == "pingpong" ? bg_pingpong : bg_tictac})`}} >
          <div className='flex flex-col md:flex-row justify-start items-center py-8 gap-4 md:gap-8 bg-bgprimary/90 w-full px-10'>
            <div className='flex items-center justify-center border-2 border-cyan-400 rounded-full p-1'>
            <img className="w-[95px] h-[95px] bg-gray-800 rounded-full flex items-center justify-center text-3xl font-bold"
                src={Avatar || default_avatar}
                crossOrigin='anonymous' 
                referrerPolicy='no-referrer' 
                onError={(e) => { e.currentTarget.src = fallbackImage }} alt="avatar" />
            </div>
            <p className=' text-center md:text-left font-bold text-2xl '>{username}</p>
            <div className=' absolute right-16 flex flex-row gap-2 font-bebas-neue'>
              <button className={`px-4 py-2 rounded-lg hover:bg-bgsecondary/30 ${ game === "pingpong" ? "text-accent font-extrabold" : ""}`} onClick={ () => {setGame("pingpong")}}>ping pong</button>
              <div className='font-black mt-2'>/</div>
              <button className={`px-4 py-2 rounded-lg hover:bg-bgsecondary/30 ${ game === "xo" ? "text-accent font-extrabold" : ""}`} onClick={ () => {setGame("xo")}}>TIC TAC TOE</button>
            </div>
            </div>
          </div>
              {/* <hr className='border-gray-200/20 m-7' /> */}
              <div className='flex flex-row w-full'>
              <div className="border-2 border-gray-500/5 p-4 rounded-2xl bg-secondary/5 flex justify-center w-full">
                <div className='flex flex-row gap-10 my-2'>
                  {gamestate.map((stat, i) => (
                    <div key={i} className='flex flex-col items-center justify-center border-2 border-secondary/10 rounded-2xl bg-black/20 hover:bg-secondary/10 p-4 hover:scale-105 m-2 w-44 transition-all duration-500 ease-in-out'>
                    <p className='font-bebas-neue my-1 px-10 text-2xl md:text-3xl lg:text-4xl text-white '>{stat.val}</p>
                    {/* <p className='font-bebas-neue'>{ game == "pingpong" ? "PING PONG" : "TIC-TAC-TOE" }</p> */}
                    <p className='text-[10px] md:text-xs text-gray-400 uppercase text-center'>{stat.label}</p>
                  </div>
                ))}
              </div>
          </div>
          
                </div>
        {/* <hr className='border-gray-400/20 m-7' /> */}
        <div className='flex flex-col md:flex-row gap-10 m-2 xxl:gap-16 items-start'>
          <div className={`flex-1 p-4 md:p-6 border-secondary/5 border-1 rounded-2xl shrink-1 h-[400px] bg-white/5 overflow-auto transition-all ${matchHistory.length === 0 ? 'min-h-0' : 'min-h-[200px]'}`}>
            <div className='flex justify-between items-center mb-6 '>
              <p className='font-bebas-neue flex items-center gap-2 text-lg lg:text-xl text-secondary '>
                <FaHistory className='w-5'/> { game == "pingpong" ? "RECENT MATCHES" : "RECENT MATCHES"}
              </p>
            </div>
            <div className="space-y-2">
              { game == "pingpong" ? (matchHistory.length > 0 ? t : <p className="text-gray-600 text-xs ">No matches recorded yet.</p>) : (matchHistory_xo.length > 0 ? t_xo : <p className="text-gray-600 text-xs ">No matches recorded yet.</p>)}
            </div>
          </div>
          <div className={`flex-1 p-4 md:p-6 border-secondary/5 border-1 rounded-2xl shrink-1 h-[400px] min-w-11 bg-white/5  transition-all ${Leaders.length === 0 ? 'min-h-0' : 'min-h-[200px]'}`}>
            <div className='flex justify-between items-center mb-6'>
                <p className='font-bebas-neue flex items-center gap-2 text-lg lg:text-xl text-secondary  '>
                  <IoPodium className='w-5'/> {game == "pingpong" ? "LEADERBOARD" : "LEADERBOARD"}
                </p>
            </div>
            <div className="space-y-2">
              { game == "pingpong" ? (Leaders.length > 0 ? res : <p className="text-gray-600 text-xs ">Ranking unavailable.</p>) : (Leaders_xo.length > 0 ? res_xo : <p className="text-gray-600 text-xs ">Ranking unavailable.</p>)}
            </div>
          </div>
        </div>
        </div>
  )
}

export default UserProfile
