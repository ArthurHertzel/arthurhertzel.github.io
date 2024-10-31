document.getElementById('enviarPergunta').addEventListener('click', async () => {
    const pergunta = document.getElementById('pergunta').value;
    if (!pergunta) return alert('Por favor, digite uma pergunta.');

    try {
        const response = await fetch('/enviar-pergunta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pergunta })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`Pergunta enviada com serial: #${data.serial}`);
        } else {
            alert(data.mensagem);
        }
    } catch (error) {
        console.error('Erro ao enviar pergunta:', error);
        alert('Erro ao enviar a pergunta.');
    }
});

document.getElementById('checarResposta').addEventListener('click', async () => {
    const serial = document.getElementById('serial').value;
    if (!serial) return alert('Por favor, insira o serial.');

    try {
        const response = await fetch(`/checar-resposta/${serial}`);
        const data = await response.json();
        if (response.ok) {
            document.getElementById('resposta').textContent = data.resposta ? `Resposta: ${data.resposta}` : 'Ainda aguardando resposta do suporte...';
        } else {
            document.getElementById('resposta').textContent = data.mensagem;
        }
    } catch (error) {
        console.error('Erro ao checar resposta:', error);
        document.getElementById('resposta').textContent = 'Erro ao buscar resposta.';
    }
});
