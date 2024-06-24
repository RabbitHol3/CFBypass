// npm install axios
const axios = require('axios');

const api_key = "b2c77f835ea088a79964949bc3589934";

const headers = {
  'Content-Type': 'application/json',
  'c-token': api_key
}

const request_config = {
  headers: headers
}

async function cfTurnstile(websiteKey, websiteURL, action) {

  const payload ={
  "type": "cf_turnstile",
  "websiteUrl": websiteURL,
  "websiteKey": websiteKey,
  "metadata": {"action": action}
};

  try {
    // const res = await axios.post("https://api.rilckz.com/captcha/tasks/", payload, request_config);
    const res = await axios.post("https://api.rilckz.com/captcha/tasks/", payload, request_config);
    const task_id = res.data.taskId;
    if (!task_id) {
      console.log("Falhou ao criar task:", res.data);
      return;
    }
    console.log("✅ Task para resolver captcha criada com sucesso! ID:", task_id);

    console.log("🔍 Aguardando resposta do captcha...");
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for 1 second

      const resp = await axios({
        method: "GET",
        url: `https://api.rilckz.com/captcha/tasks/${task_id}`,
        headers: request_config.headers
      })
      const status = resp.data.status;

      if (status === "ready") {
        console.log("✅ Captcha resolvido com sucesso!");
        return resp.data.solution;
      }
      if (status === "failed" || resp.data.errorId) {
        console.log("⚠️ Falhou ao resolver captcha! resposta:", resp.data);
        return;
      }
    }
  } catch (error) {
    console.error("Erro:", error);
  }
}

module.exports = {cfTurnstile};