const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const { url } = require('inspector');
const { get } = require('http');
const consts = require('./consts');
let wp_encrypter = require('./wp_encrypter');

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
        // utilizando puppeteer para pegar o cf-ray
        // tentar pegar o cf-ray utilizando requisição e não funcionou, preciso investigar mais

        await puppeteer.launch(
            { 
                headless: true,
                executablePath: executablePath(),

             }
        ).then(async browser => {
            // cf-ray é retornado no header da resposta
            // então precisamos interceptar a resposta
            // e pegar o cf-ray
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
                        }
                    }
                });
            });
            const page = await browser.newPage(this.baseUrl)
           try{
               await page.goto(this.baseUrl);
           }catch(error){
                if (!error.message.includes('Navigating frame was detached')) {
                    throw error;
                }
            }
           
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
        // essa requisição é feita para pegar os cookies
        await this.session.post(
            `${this.baseUrl}/cdn-cgi/challenge-platform/h/g/jsd/r/${this.cfRay}`,
            payload,
        ).then(response => {
            console.log(response.data);
        })

    }

}

async function getCloudflareCookies(session, baseUrl) {
    const bypasser = new CloudflareBypasser(session, baseUrl);
    await bypasser.getValues();
    await bypasser.getCfRay();
    await bypasser.getCookies();
    
}

module.exports = {getCloudflareCookies};