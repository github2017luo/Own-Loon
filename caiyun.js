/*忘记从那位大佬那复制的，🙏，稍微做了些改动，如果有侵权，请联系我删除
只需要在经纬度填上自己的
因为要修改经纬度，所有只能添加本地js文件
*/
var caiyun_api = "fpj5k37EoWtfgZVp";  //彩云天气API
var tencent_api = "EJOBZ-HCGCX-34V4P-TKXDW-7OHHV-5GF4I";  //腾讯地图API
var location_latitude = "34.242765";  //纬度
var location_longitude = "109.001826";  //经度

/********************** SCRIPT START *********************************/
const $ = API("caiyun");
const ERR = MYERR();
const display_location = JSON.parse($.read("display_location") || "false");

if (typeof $request !== "undefined") {
  // get location from request url
  const url = $request.url;
  const res =
    url.match(/weather\/.*?\/(.*)\/(.*)\?/) ||
    url.match(/geocode\/([0-9.]*)\/([0-9.]*)\//) ||
    url.match(/geocode=([0-9.]*),([0-9.]*)/);
  if (res === null) {
    $.notify(
      "[彩云天气]",
      " 正则表达式匹配错误",
      `🥬 无法从URL: ${url} 获取位置。`
    );
    $.done({ body: $request.body });
  }
} else {
  // this is a task
  !(async () => {
    const { caiyun, tencent } = $.read("token") || {};

      await scheduler();

  })()
    .catch((err) => {
      if (err instanceof ERR.TokenError)
        $.notify(
          "[彩云天气]",
          err.message,
          "🤖 由于API Token具有时效性，请前往\nhttps://t.me/cool_scripts\n获取最新Token。",
          {
            "open-url": "https://t.me/cool_scripts",
          }
        );
      else $.notify("[彩云天气]", " 出现错误", err.message);
    })
    .finally($.done());
}

async function scheduler() {
  const now = new Date();
  $.log(
    `Scheduler activated at ${
      now.getMonth() + 1
    }月${now.getDate()}日${now.getHours()}时${now.getMinutes()}分`
  );
  await query();
  weatherAlert();
  realtimeWeather();
}

async function query() {
  const now = new Date();
    // query API
    const url = `https://api.caiyunapp.com/v2.5/${caiyun_api}/${location_longitude},${location_latitude}/weather?lang=zh_CN&dailystart=0&hourlysteps=384&dailysteps=16&alert=true`;

    $.log("Query weather...");

    const weather = await $.get({
      url,
      headers: {
        'User-Agent': 'ColorfulCloudsPro/5.0.10 (iPhone; iOS 13.5.1; Scale/3.00)'
      }
    }).then(resp => {
      const body = JSON.parse(resp.body);
      if (body.status === 'failed') {
        throw new Error(body.error);
      }
      return body;
    }).catch(err => {
      throw err;
    });

    $.log("Query location...");
    await $.wait(Math.random()*2000);
    const address =
      await $
        .get(`https://apis.map.qq.com/ws/geocoder/v1/?key=${tencent_api}&location=${location_latitude},${location_longitude}`)
        .then(resp => {
          const body = JSON.parse(resp.body);
          if (body.status !== 0) {
            throw new ERR.TokenError(" 腾讯地图Token错误");
          }
          return body.result.address_component;
        }).catch(err => {
          throw err;
        });

    $.weather = weather;

    if (display_location == true) {
      $.info(JSON.stringify(address));
    }
    $.address = address;
}

function weatherAlert() {
  const data = $.weather.result.alert;
  const address = $.address;
  const alerted = $.read("alerted") || [];

  if (data.status === "ok") {
    data.content.forEach((alert) => {
      if (alerted.indexOf(alert.alertId) === -1) {
        $.notify(
          `${address.city} ${address.district} ${address.street}`,
          alert.title,
          alert.description
        );
        alerted.push(alert.alertId);
        if (alerted.length > 10) {
          alerted.shift();
        }
        $.write(alerted, "alerted");
      }
    });
  }
}

function realtimeWeather() {
  const data = $.weather.result;
  const address = $.address;

  const alert = data.alert;
  const alertInfo =
    alert.content.length == 0
      ? ""
      : alert.content.reduce((acc, curr) => {
          if (curr.status === "预警中") {
            return acc + "\n" + mapAlertCode(curr.code) + "预警";
          } else {
            return acc;
          }
        }, "[预警]") + "\n\n";

  const realtime = data.realtime;
  const keypoint = data.forecast_keypoint;

  const hourly = data.hourly;

  let hourlySkycon = "[未来3小时]\n";
  for (let i = 0; i < 3; i++) {
    const skycon = hourly.skycon[i];
    const dt = new Date(skycon.datetime);
    const now = dt.getHours() + 1;
    dt.setHours(dt.getHours() + 1);
    hourlySkycon +=
      `${now}-${dt.getHours() + 1}时 ${mapSkycon(skycon.value)[0]}` +
      (i == 2 ? "" : "\n");
  }

  $.notify(
    `[彩云天气] ${address.city} ${address.district} ${address.street}`,
    `${mapSkycon(realtime.skycon)[0]} ${realtime.temperature} ℃  🌤 空气质量 ${
      realtime.air_quality.description.chn
    }`,
    `🔱 ${keypoint}
🌡 体感 ${realtime.life_index.comfort.desc} ${
      realtime.apparent_temperature
    } ℃  💧 湿度 ${(realtime.humidity * 100).toFixed(0)} %%
💨 风力 ${mapWind(
      realtime.wind.speed,
      realtime.wind.direction
    )}🌞 紫外线 ${realtime.life_index.ultraviolet.desc}

${alertInfo}${hourlySkycon}
`,
    {
      "media-url": `${mapSkycon(realtime.skycon)[1]}`,
    }
  );
}

function dailyForcast() {}

/************************** 天气对照表 *********************************/

function mapAlertCode(code) {
  const names = {
    "01": "🌪 台风",
    "02": "⛈ 暴雨",
    "03": "❄️ 暴雪",
    "04": "❄ 寒潮",
    "05": "💨 大风",
    "06": "💨 沙尘暴",
    "07": "☄️ 高温",
    "08": "☄️ 干旱",
    "09": "⚡️ 雷电",
    "10": "💥 冰雹",
    "11": "❄️ 霜冻",
    "12": "💨 大雾",
    "13": "💨 霾",
    "14": "❄️ 道路结冰",
    "15": "🔥 森林火灾",
    "16": "⛈ 雷雨大风",
  };

  const intensity = {
    "01": "蓝色",
    "02": "黄色",
    "03": "橙色",
    "04": "红色"
  };

  const res = code.match(/(\d{2})(\d{2})/);
  return `${names[res[1]]}${intensity[res[2]]}`
}

function mapWind(speed, direction) {
  let description = "";
  if (speed < 1) {
    description = "无风";
  } else if (speed <= 5) {
    description = "1级 微风徐徐";
  } else if (speed <= 11) {
    description = "2级 清风";
  } else if (speed <= 19) {
    description = "3级 树叶摇摆";
  } else if (speed <= 28) {
    description = "4级 树枝摇动";
  } else if (speed <= 38) {
    description = "5级 风力强劲";
  } else if (speed <= 49) {
    description = "6级 风力强劲";
  } else if (speed <= 61) {
    description = "7级 风力超强";
  } else if (speed <= 74) {
    description = "8级 狂风大作";
  } else if (speed <= 88) {
    description = "9级 狂风呼啸";
  } else {
    description = ">9级 台风";
  }
  return description;
}

// 天气状况 --> 自然语言描述
function mapSkycon(skycon) {
  const map = {
    "CLEAR_DAY": ["☀️ 日间晴朗"],
    "CLEAR_NIGHT": ["✨ 夜间晴朗"],
    "PARTLY_CLOUDY_DAY": ["⛅️ 日间多云"],
    "PARTLY_CLOUDY_NIGHT": ["☁️ 夜间多云"],
    "CLOUDY": ["☁️阴"],
    "LIGHT_HAZE": ["😤 轻度雾霾"],
    "MODERATE_HAZE": ["😤 中度雾霾"],
    "HEAVY_HAZE": ["😤 重度雾霾"],
    "LIGHT_RAIN": ["💧 小雨"],
    "MODERATE_RAIN": ["💦 中雨"],
    "HEAVY_RAIN": ["🌧 大雨"],
    "STORM_RAIN": ["⛈ 暴雨"],
    "LIGHT_SNOW": ["🌨 小雪"],
    "MODERATE_SNOW": ["❄️ 中雪"],
    "HEAVY_SNOW": ["☃️ 大雪"],
    "STORM_SNOW": ["⛄️ 暴雪"],
    "DUST": ["💨 浮尘"],
    "SAND": ["💨 沙尘"],
    "WIND": ["🌪 大风"]
  }
  return map[skycon];
}

// 雷达降 水/雪 强度 --> skycon
function mapPrecipitation(intensity) {
  if (0.031 < intensity && intensity < 0.25) {
    return "LIGHT";
  } else if (intensity < 0.35) {
    return "MODERATE";
  } else if (intensity < 0.48) {
    return "HEADY";
  } else if (intensity >= 0.48) {
    return "STORM";
  }
}

function mapIntensity(breakpoints) {

}

/************************** ERROR *********************************/
function MYERR() {
  class TokenError extends Error {
    constructor(message) {
      super(message);
      this.name = "TokenError";
    }
  }

  return {
    TokenError
  }
}

// prettier-ignore
/*********************************** API *************************************/
function API(s="untitled",t=!1){return new class{constructor(s,t){this.name=s,this.debug=t,this.isQX="undefined"!=typeof $task,this.isLoon="undefined"!=typeof $loon,this.isSurge="undefined"!=typeof $httpClient&&!this.isLoon,this.isNode="function"==typeof require,this.isJSBox=this.isNode&&"undefined"!=typeof $jsbox,this.node=(()=>{if(this.isNode){const s="undefined"!=typeof $request?void 0:require("request"),t=require("fs");return{request:s,fs:t}}return null})(),this.initCache();const e=(s,t)=>new Promise(function(e){setTimeout(e.bind(null,t),s)});Promise.prototype.delay=function(s){return this.then(function(t){return e(s,t)})}}get(s){return this.isQX?("string"==typeof s&&(s={url:s,method:"GET"}),$task.fetch(s)):new Promise((t,e)=>{this.isLoon||this.isSurge?$httpClient.get(s,(s,i,o)=>{s?e(s):t({status:i.status,headers:i.headers,body:o})}):this.node.request(s,(s,i,o)=>{s?e(s):t({...i,status:i.statusCode,body:o})})})}post(s){return this.isQX?("string"==typeof s&&(s={url:s}),s.method="POST",$task.fetch(s)):new Promise((t,e)=>{this.isLoon||this.isSurge?$httpClient.post(s,(s,i,o)=>{s?e(s):t({status:i.status,headers:i.headers,body:o})}):this.node.request.post(s,(s,i,o)=>{s?e(s):t({...i,status:i.statusCode,body:o})})})}initCache(){if(this.isQX&&(this.cache=JSON.parse($prefs.valueForKey(this.name)||"{}")),(this.isLoon||this.isSurge)&&(this.cache=JSON.parse($persistentStore.read(this.name)||"{}")),this.isNode){let s="root.json";this.node.fs.existsSync(s)||this.node.fs.writeFileSync(s,JSON.stringify({}),{flag:"wx"},s=>console.log(s)),this.root={},s=`${this.name}.json`,this.node.fs.existsSync(s)?this.cache=JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)):(this.node.fs.writeFileSync(s,JSON.stringify({}),{flag:"wx"},s=>console.log(s)),this.cache={})}}persistCache(){const s=JSON.stringify(this.cache);this.isQX&&$prefs.setValueForKey(s,this.name),(this.isLoon||this.isSurge)&&$persistentStore.write(s,this.name),this.isNode&&(this.node.fs.writeFileSync(`${this.name}.json`,s,{flag:"w"},s=>console.log(s)),this.node.fs.writeFileSync("root.json",JSON.stringify(this.root),{flag:"w"},s=>console.log(s)))}write(s,t){this.log(`SET ${t}`),-1!==t.indexOf("#")?(t=t.substr(1),this.isSurge&this.isLoon&&$persistentStore.write(s,t),this.isQX&&$prefs.setValueForKey(s,t),this.isNode&&(this.root[t]=s)):this.cache[t]=s,this.persistCache()}read(s){return this.log(`READ ${s}`),-1===s.indexOf("#")?this.cache[s]:(s=s.substr(1),this.isSurge&this.isLoon?$persistentStore.read(s):this.isQX?$prefs.valueForKey(s):this.isNode?this.root[s]:void 0)}delete(s){this.log(`DELETE ${s}`),delete this.cache[s],-1!==s.indexOf("#")?(s=s.substr(1),this.isSurge&this.isLoon&&$persistentStore.write(null,s),this.isQX&&$prefs.setValueForKey(null,s),this.isNode&&delete this.root[s]):this.cache[s]=data,this.persistCache()}notify(s,t="",e="",i={}){const o=i["open-url"],n=i["media-url"],r=e+(o?`\n点击跳转: ${o}`:"")+(n?`\n多媒体: ${n}`:"");if(this.isQX&&$notify(s,t,e,i),this.isSurge&&$notification.post(s,t,r),this.isLoon&&$notification.post(s,t,e,o),this.isNode)if(this.isJSBox){const e=require("push");e.schedule({title:s,body:(t?t+"\n":"")+r})}else console.log(`${s}\n${t}\n${r}\n\n`)}log(s){this.debug&&console.log(s)}info(s){console.log(s)}error(s){console.log("ERROR: "+s)}wait(s){return new Promise(t=>setTimeout(t,s))}done(s={}){this.isQX||this.isLoon||this.isSurge?$done(s):this.isNode&&!this.isJSBox&&"undefined"!=typeof $context&&($context.headers=s.headers,$context.statusCode=s.statusCode,$context.body=s.body)}}(s,t)}
/*****************************************************************************/
