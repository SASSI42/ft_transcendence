import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useParams } from 'react-router-dom';
import default_avatar from './../assets/default_avatar.png'
import getBackendUrl from '../api/getUrl';
import { useEffect, useState, useMemo, useRef} from 'react';


interface GameStats {
  total: number,
  wins: number,
  loses: number,
  rate: number,
  t_totale: number,
  t_win: number
}

interface GameStats_xo {
  total_xo: number,
  wins_xo: number,
  loses_xo: number,
  rate_xo: number,
  t_totale_xo: number,
  t_win_xo: number
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#050606] border border-[#e5e8df] p-3 rounded-lg shadow-xl">
        <p className="text-[#dfe8E2] text-xs font-medium mb-1">
          {payload[0].payload.fullDate}
        </p>
        <p className="text-cyan-400 font-bebas-neue text-lg leading-none">
          SCORE: <span className="text-white">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const DashboardPage = () => {

const [dims, setDims] = useState({ width: 0, height: 0 });
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!containerRef.current) return;

  const resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        setDims({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    }
  });

  resizeObserver.observe(containerRef.current);
  return () => resizeObserver.disconnect(); // Cleanup
}, []);

    const {id:ProfileId} = useParams();
  const [Avatar, setAvatar] = useState(default_avatar);
  const [pongStats, setPongData] = useState<GameStats>({
  total: 0,
  wins: 0,
  loses: 0,
  rate: 0,
  t_totale: 0,
  t_win: 0
  });
  const [xoStats, setXoData] = useState<GameStats_xo>({
  total_xo: 0,
  wins_xo: 0,
  loses_xo: 0,
  rate_xo: 0,
  t_totale_xo: 0,
  t_win_xo: 0
  });
  const [username, setUsername] = useState('Loading...');
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [xomatchHistory, setXoMatchHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetch_data = async () => {
      try{
        const end_point = `${getBackendUrl()}:3000/api/user/user_profile`
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
            setXoMatchHistory(res.xo.history || []);

            const total =  res.pong?.stats?.total || 0;
            const wins = res.pong?.stats?.wins || 0;
            const total_xo =  res.xo?.stats?.total || 0;
            const wins_xo = res.xo?.stats?.wins || 0;
            

            setPongData({
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
              rate_xo: total_xo > 0 ? Math.round((wins_xo / total_xo) * 100): 0,
              t_totale_xo: res.tournaments?.played || 0,
              t_win_xo: res.tournaments?.won || 0
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
    const pongStatsList = useMemo(() => [
      {label: 'Matches played', val: pongStats.total },
      {label: 'Matches won', val: pongStats.wins },
      {label: 'Matches lost', val: pongStats.loses },
      {label: 'Win Rate', val: `${pongStats.rate}%` },
      {label: 'Tournaments played', val: pongStats.t_totale },
      {label: 'Tournaments won', val: pongStats.t_win },
    ], [pongStats]);
  
      const XOStatsList = useMemo(() => [
      {label: 'Matches played', val: xoStats.total_xo },
      {label: 'Matches won', val: xoStats.wins_xo },
      {label: 'Matches lost', val: xoStats.loses_xo },
      {label: 'Win Rate', val: `${xoStats.rate_xo}%` },
    ], [xoStats]);


    const chartData = matchHistory.reverse().map((match, index) => {
  return {
    name: `Match ${index + 1}`,
    score: match.p1_username === username ? match.p1_score : match.p2_score,
    opponentScore: match.p1_username === username ? match.p1_score : match.p2_score,
    fullDate: new Date(match.created_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})
  };
});

  const chartDataXo = xomatchHistory.reverse().map((match, index) => {
  return {
    name: `Match ${index + 1}`,
    score: match.p1_username === username ? match.p1_score : match.p2_score,
    opponentScore: match.p1_username === username ? match.p1_score : match.p2_score,
    fullDate: new Date(match.joined_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})
  };
});


    return (
        <div className="h-full w-full bg-[27EEF5] text-white p-4 lg:p-4  overflow-x-hidden 2xl:overflow-y-hidden">
            
            <div className='flex items-center gap-6 border-b border-gray-800 pb-8'>
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-2 border-cyan-500 p-1">
                        <img className=" w-full h-full bg-gray-800 rounded-full flex items-center justify-center text-3xl font-bold text-teal-500"
                            src={Avatar || default_avatar}
                            crossOrigin='anonymous' 
                            referrerPolicy='no-referrer'
                            onError={(e) => { e.currentTarget.src = fallbackImage }} alt="avatar" />
                    </div>
                </div>
                <div>
                    <h1 className='text-2xl font-bold italic'>{username}</h1>
                </div>

            </div>
                <hr className='border-2 border-gray-500'/>
            <div className='flex justify-between justify-center'>
            <div className='grid grid-cols-3 border-2 border-gray-600 bg-teal-300/10 rounded-3xl m-1'>
                {pongStatsList.map((stat,  i) => (
                    <div key={i} className='flex flex-col items-center justify-center italic border-2 border-teal-600  rounded-2xl bg-black/20 hover:border-teal-200 m-2'>
                    <p className='font-bebas-neue text-2xl md:text-3xl lg:text-4xl text-white m-1'>{stat.val}</p>
                    <p className='font-bebas-neue'>PING-PONG</p>
                    <p className='text-[10px] md:text-xs text-gray-400 uppercase text-center'>{stat.label}</p>
                  </div>
                ))}
            </div>
          <div className=" border-2 border-gray-500 rounded-2xl bg-cyan-300/10 m-1 h-full">
                <div className='grid grid-cols-2'>
                  {XOStatsList.map((stat, i) => (
                    <div key={i} className='flex flex-col items-center justify-center  italic border-2 border-cyan-600 rounded-2xl bg-black/20 hover:border-cyan-400 transition-colors p-4 hover:scale-105 m-2'>
                    <p className='font-bebas-neue text-2xl md:text-3xl lg:text-4xl text-white '>{stat.val}</p>
                    <p className='font-bebas-neue'>TIC-TAC-TOE</p>
                    <p className='text-[10px] md:text-xs text-gray-400 uppercase text-center'>{stat.label}</p>
                  </div>
                ))}
              </div>
          </div>
                </div>

            <div className='grid lg:grid-cols-3 gap-6'>
                <div className="lg:col-span-2 min-w-0 bg-white/5 border border-gray-800 rounded-2xl p-6">
                  <h3 className="font-bebas-neue text-2xl mb-3 text-cyan-400">CAREER PROGRESSION_#PING-PONG</h3>

                  <div ref={containerRef} className="w-[12] h-[300px]">
                    {dims.width > 0 && (
                      <AreaChart 
                        width={dims.width} 
                        height={dims.height} 
                        data={chartData}
                      >
                        <defs>
                          <linearGradient id="colorScoreXO" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2dccd4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2dd4c0" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="fullDate" stroke="#dfe8E2ff" fontSize={8} />
                        <YAxis allowDecimals={false} stroke="#DFE3E8" fontSize={10} width={40} interval={0} domain={[0, 'auto']} tickCount={12} tickLine={false}/>
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e8dcdcff', strokeWidth: 2 }} />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#2dc0d4" 
                          fill="url(#colorScoreXO)" 
                          strokeWidth={2} 
                        />
                      </AreaChart>
                    )}
                  </div>
                </div>
                <div className='bg-white/5 border border-gray-800 rounded-2xl p-6'>
                    <h3 className="font-bebas-neue text-2xl mb-6 text-cyan-400">RECENT maches_#PING-PONG</h3>
                    <div className="space-y-4 overflow-auto max-h-[300px]">
                        {matchHistory.map((match, i) => (
                            <div key={match.id || `pong-${i}`} className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-gray-700 transition">
                                <div>
                                    <p className="text-sm font-bold">vs {match.p1_username === username ? match.p2_username : match.p1_username}</p>
                                    <p className="text-[10px] text-gray-500">{'PING-PONG'} • {new Date(match.created_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})}</p>
                                </div>
                                    <div className={`font-bebas-neue text-xl`}>
                                    <span>{match.p1_username === username ? match.p2_score : match.p1_score}</span>
                                    <span> - </span>
                                    <span>{match.p1_username === username ? match.p1_score : match.p2_score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 min-w-0 bg-white/5 border border-gray-800 rounded-2xl p-6">
                  <h3 className="font-bebas-neue text-2xl mb-3 text-cyan-400">CAREER PROGRESSION_#TIC-TAC-TOE</h3>

                  <div ref={containerRef} className="w-[12] h-[300px]">
                    {dims.width > 0 && (
                      <AreaChart 
                        width={dims.width} 
                        height={dims.height} 
                        data={chartDataXo}
                      >
                        <defs>
                          <linearGradient id="colorScoreXO" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2dccd4" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2dd4c0" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="fullDate" stroke="#dfe8E2ff" tick={{ fontSize: '12px', fill: '#DFE3E8' }} />
                        <YAxis domain={[0, 2]} allowDecimals={false} stroke="#DFE3E8" tickCount={3} interval={0}/>
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f0eaeaff', strokeWidth: 2 }} />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#2dc0d4" 
                          fill="url(#colorScoreXO)" 
                          strokeWidth={3} 
                        />
                      </AreaChart>
                    )}
                  </div>
                </div>
                  <div className='bg-white/5 border border-gray-800 rounded-2xl p-6'>
                    <h3 className="font-bebas-neue text-2xl mb-6 text-cyan-400">RECENT maches_#TIC-TAC-TOE</h3>
                    <div className="space-y-4 overflow-auto max-h-[300px]">
                        {xomatchHistory.map((match, i) => (
                            <div key={i} className="flex justify-between items-center p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-gray-700 transition">
                                <div>
                                    <span className="text-sm font-bold"> vs {match.p1_username === username ? match.p2_username : match.p1_username}</span>
                                    <p className="text-[10px] text-gray-500">{'TIC-TAC-TOE'} • {new Date(match.joined_at).toLocaleString('en-US', {month: 'short',day: 'numeric',hour: '2-digit',minute: '2-digit',})}</p>
                                </div>
                                <div className={`font-bebas-neue text-xl `}>
                                    <span>{match.p1_username === username ? match.p2_score : match.p1_score}</span>
                                    <span> - </span>
                                    <span>{match.p1_username === username ? match.p1_score : match.p2_score}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            
        </div>
    );
};

export default DashboardPage;
