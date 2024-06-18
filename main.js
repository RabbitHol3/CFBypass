const axios = require('axios');
const consts = require('./consts');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const tls = require('tls');
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
let wp_encrypter = require('./wp_encrypter');
const captcha_solver = require('./captcha_solver');


class CloudflareBypasser{
    constructor(session, baseUrl) {
        this.session = session;
        this.baseUrl = baseUrl;
        this.userAgent = session.defaults.headers.common["User-Agent"]
        this.baseData = consts.consultacidadao_cf_base_data(this.userAgent, baseUrl);
        this.cfRay = null;
        this.s = null;
        this.key = null;
    }

    async getCfRay() {
        // using puppeteer to get the cf-ray
        // i tried to get the cf-ray using axios but it was not working
        await puppeteer.launch(
            { 
                headless: false,
                executablePath: executablePath(),

             }
        ).then(async browser => {
            // cf-ray is recieved after the first request
            // so we need to intercept the first request
            // and get the cf-ray from the response headers
            browser.on('targetcreated', async target => {
                const page = await target.page();
                if (!page) {
                    return;
                }
                page.on('response', async response => {
                    if (response.url().startsWith(this.baseUrl)) {
                        this.cfRay = response.headers()['cf-ray'];
                        // close browser
                        // and ignore if any error when closing
                        try {
                            await browser.close();
                        } catch (error) {
                            console.error(error);
                        }
                    }
                });
            });
            const page = await browser.newPage();
            await page.goto(this.baseUrl);
        })
    }

    async getValues() {
        // https://hortolandia.consultacidadao.com.br/cdn-cgi/challenge-platform/h/g/scripts/jsd/6aac8896f227/main.js
        const response = await this.session.get(
            `${this.baseUrl}/cdn-cgi/challenge-platform/h/g/scripts/jsd/6aac8896f227/main.js`,
            // "https://www.google.com/",
        );
        if (response.status !== 200) {
            throw new Error('Failed to fetch main.js');
        }

        const soup = response.data.split('ah=\'')[1].split('\'.split(')[0];
        for (const x of soup.split(',')) {
            if (x.length === 65 && !x.includes('=')) {
                this.key = x;
            }
        }
        const regex_pattern = /.*0\.(\d{12,20}):(\d{10}):([a-zA-Z0-9_+*\\-]{43}).*/;
        const x = soup.match(regex_pattern);
        // const s = '0.' + x[0].join(':');
        this.s = `0.${x[1]}:${x[2]}:${x[3]}`;

        if (!this.key) {
            soup = soup.replace(s, '');
            this.key = soup.split(',').find(x => x.includes('-') && x.length > 20);
        }
    }

    async getEncryptedWp(data) {
        const str_data = JSON.stringify(data);
        return wp_encrypter.encrypt(str_data, this.key);
    }

    async getCookies() {
        const payload = {
            'wp' : await this.getEncryptedWp(this.baseData),
            's' : this.s,
        }
        // this request will set the cookies
        // and we will be able to make the final request
        await this.session.post(
            `${this.baseUrl}/cdn-cgi/challenge-platform/h/g/jsd/r/${this.cfRay}`,
            payload,
        ).then(response => {
            console.log(response.data);
        })

    }

}

const jar = new CookieJar();
const session = wrapper(axios.create({ jar }));

// set headers
session.defaults.headers.common = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7", 
    "Accept-Encoding": "gzip, deflate, br, zstd", 
    "Accept-Language": "en-US,en;q=0.9,pt;q=0.8", 
    "Dnt": "1", 
    "Priority": "u=0, i", 
    "Sec-Ch-Ua": "\"Google Chrome\";v=\"125\", \"Chromium\";v=\"125\", \"Not.A/Brand\";v=\"24\"", 
    "Sec-Ch-Ua-Mobile": "?0", 
    "Sec-Ch-Ua-Platform": "\"Windows\"", 
    "Sec-Fetch-Dest": "document", 
    "Sec-Fetch-Mode": "navigate", 
    "Sec-Fetch-Site": "cross-site", 
    "Sec-Fetch-User": "?1", 
    "Upgrade-Insecure-Requests": "1", 
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "X-Amzn-Trace-Id": "Root=1-6670d00a-54c9c6f5774e524964ce24d1"
  }


async function getCloudflareCookies(session, baseUrl) {
    const bypasser = new CloudflareBypasser(session, baseUrl);
    // console.log(bypasser.session.defaults.jar.store.idx)
    await bypasser.getValues();
    await bypasser.getCfRay();
    await bypasser.getCookies();
    // console.log(bypasser.session.defaults.jar.store.idx)
}

(async() =>{    
    // get the cookies
    let baseUrl = 'https://hortolandia.consultacidadao.com.br';
    let cfWebsiteKey = '0x4AAAAAAAbRWU6g1TGKS2Wl'
    let cfAction = 'consulta-multas-2951'

    await getCloudflareCookies(session, baseUrl);
    
    // make your requests now using the session
    const cf_token = await captcha_solver.cfTurnstile(cfWebsiteKey, baseUrl, cfAction)
    
})();