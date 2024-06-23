const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');
const captcha_solver = require('./captcha_solver');
const { getCloudflareCookies } = require('./cf_bypasser');
const cheerio = require('cheerio');
const { assert } = require('puppeteer');

const baseUrl = 'https://hortolandia.consultacidadao.com.br';
const cfWebsiteKey = '0x4AAAAAAAbRWU6g1TGKS2Wl';
const cfAction = 'consulta-multas-2951';

async function parseMultas(html) {
    const $ = cheerio.load(html);
    const tables = [];
    $('table').each((i, table) => {
        const headers = [];
        $(table).find('thead tr th').each((j, th) => {
            const header = $(th).text().trim();
            if (header) {
                headers.push(header);
            } else {
                headers.push(null); // mantém a ordem das colunas
            }
        });

        if (headers.filter(Boolean).length <= 1) return; // ignora tabelas sem cabeçalho

        const tableData = [];
        $(table).find('tbody tr').each((j, row) => {
            const rowData = {};
            $(row).find('td').each((k, cell) => {
                const button = $(cell).find('button');
                if (headers[k] || button.length) { // ignora colunas sem cabeçalho
                    if (button.length) {
                        // Captura o evento de clique do botão
                        // Nele contem os dados necessários para 
                        // fazer a requisição de detalhes da multa
                        // visualizaAutoInfracao(orgao, ait, digito)                        
                        regex = /visualizaAutoInfracao\((\d+),\s*'([^']*)',\s*'([^']*)'\)/;
                        match = button.attr('onclick').match(regex);
                        if (match) {             
                            rowData['detalhes'] = {
                                orgao: match[1],
                                ait: match[2],
                                digito: match[3]
                            };
                        }
                    } else {
                        rowData[headers[k]] = $(cell).text().trim();
                    }
                }
            });
            if (Object.keys(rowData).length) tableData.push(rowData);
        });

        if (tableData.length) tables.push(tableData);
    });
    return tables[0];
    
    

}

async function extractTrafficViolationData(html) {

    const css_paths = {
        placa : 'table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td:nth-child(1)',
        data : 'table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td:nth-child(2)',
        local : 'table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(2) > td:nth-child(3)',
        codigo : 'table > tbody > tr:nth-child(3) > td > table > tbody > tr:nth-child(2) > td:nth-child(1)',
        descricao : 'table > tbody > tr:nth-child(3) > td > table > tbody > tr:nth-child(2) > td:nth-child(2)',
        observacao: 'table > tbody > tr:nth-child(6) > td',
    }

    const $ = cheerio.load(html);
    
    const infracao = {};

    // Extract the Auto de Infração de Trânsito number
    infracao.numero = $('div.mainContent h3').text().split(': ')[1];
    infracao.placa = $(css_paths.placa).text().trim();
    infracao.data = $(css_paths.data).text().trim();
    infracao.local = $(css_paths.local).text().trim();
    infracao.codigo = $(css_paths.codigo).text().trim();
    infracao.descricao = $(css_paths.descricao).text().trim();
    infracao.observacao = $(css_paths.observacao).text().trim();
    return infracao
}

async function consultaPlaca(session, placa, renavam, captchaToken) {
    const uri = '/consultaMultas/consulta';
    const data = {
        param1: renavam,
        param2: placa,
        "cf-turnstile-response": captchaToken
    };
    
    const body = Object.keys(data).map(key => key + '=' + data[key]).join('&');
    
    const cf_clearance = session.defaults.jar.store.idx['consultacidadao.com.br']['/'].cf_clearance.value

    response = await fetch("https://hortolandia.consultacidadao.com.br/consultaMultas/consulta", {
        "headers": {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
          "cookie": "PHPSESSID-web-2=id5oaopmo15nov34p13ovm3g98; __utma=195548853.873603165.1719084086.1719084086.1719084086.1; __utmb=195548853.0.10.1719084086; __utmc=195548853; __utmz=195548853.1719084086.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); cf_clearance=" + cf_clearance,
        },
        "body": "param1=01216271094&param2=FTB7868&cf-turnstile-response=" + captchaToken,
        "method": "POST"
      })
    
    if (response.status !== 200) {
        throw new Error(`Erro ao consultar multas: ${response.status
        }`);
    }
    const html = await response.text();
    multas = await parseMultas(html);
    return multas
    // if 

}

async function multaDetalhes(cf_clearance, orgao, ait, digito) {

    if (!cf_clearance) {
        throw new Error('⚠️ cf_clearance cookie não encontrado 🍪');
    }
    
    const body =`orgao=${orgao}&ait=${ait}&digito=${digito}`
    response = await fetch("https://hortolandia.consultacidadao.com.br/consultaMultas/visualizarMulta",
        {
            "headers": {
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "cookie": "cf_clearance=" + cf_clearance,
            },
            "body": body,
            "method": "POST"
        })
    if (response.status !== 200) {
        throw new Error(`Erro ao consultar multas: ${response.status
        }`);
    }
    const html = await response.text();
    const dados = await extractTrafficViolationData(html);
    return dados

}
(async() =>{
        
    const jar = new CookieJar();
    let session = wrapper(axios.create({ jar }));
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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "X-Amzn-Trace-Id": "Root=1-6670d00a-54c9c6f5774e524964ce24d1"
      }

    console.log(`🍪 Validando cookies para ${baseUrl} ...`);

    await getCloudflareCookies(session, baseUrl);
    cf_clearance = session.defaults.jar.store.idx['consultacidadao.com.br']['/'].cf_clearance.value
    if (!cf_clearance) {
        throw new Error('⚠️ cf_clearance cookie não encontrado 🍪');
    }
    console.log(`✅ Cookies validados com sucesso!\n`);
    // Apartir daqui já temos os cookies necessários para fazer as requisições
    // Agora vamos fazer a requisição para obter as multas
    console.log('>>> Executando requisição para obter detalhes da multa...');    
    //orgao="2951", ait="S00196930", digito="1"
    const dados = await multaDetalhes(cf_clearance, "2951", "S00196930", "1")
    console.log(dados )     
    
    
    // Caso a requisição necessite de validar o captcha, a função abaixo pode ser utilizada
    console.log('\n ############# Validando captcha #############');    
    const solution = await captcha_solver.cfTurnstile(cfWebsiteKey, baseUrl, cfAction)
    console.log('🔑 Token:', solution.token);

    // Compara userAgent, caso seja diferente, atualiza
    if (session.defaults.headers.common['User-Agent'] !== solution.userAgent) {
        session.defaults.headers.common['User-Agent'] = solution.userAgent;
    }
    // Agora faz as requisições necessárias
    console.log('\n Executando requisição para obter multas, com captcha validado e cookies atualizados...');
    resultado = await consultaPlaca(session, 'FTB7868', '01216271094', solution.token);
    for (const multa of resultado) {
        console.log(multa);
    }
})();