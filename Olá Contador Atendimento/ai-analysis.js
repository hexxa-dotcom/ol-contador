/**
 * ai-analysis.js - Fluxo Simulado de IA para Análise de PDFs
 */

document.addEventListener('DOMContentLoaded', () => {
  const pdfUpload = document.getElementById('copilot-pdf-upload');
  
  if (pdfUpload) {
    pdfUpload.addEventListener('change', function(e) {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        const chatBox = document.getElementById('copilot-chat');
        
        if (!chatBox) return;

        // 1. Cria a bolha do usuário com o arquivo
        const userDiv = document.createElement("div");
        userDiv.style.display = "flex";
        userDiv.style.justifyContent = "flex-end";
        
        const fileName = file.name;
        
        userDiv.innerHTML = `
          <div class="copilot-user-bubble" style="background: var(--color-card); border: 1px solid var(--color-border); color: var(--color-text); display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-pdf" style="color: #E74C3C; font-size: 20px;"></i>
            <div style="text-align: left;">
              <span style="display: block; font-weight: 600; font-size: 13px;">${fileName}</span>
              <span style="font-size: 11px; color: var(--color-text-secondary);">Enviado para análise</span>
            </div>
          </div>
        `;
        chatBox.appendChild(userDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // 2. Mostra indicador da IA (Loading)
        const aiDiv = document.createElement("div");
        aiDiv.style.display = "flex";
        aiDiv.style.gap = "12px";
        aiDiv.style.maxWidth = "90%";
        aiDiv.style.marginTop = "8px";

        aiDiv.innerHTML = `
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--color-pine); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
            <i class="fa-solid fa-robot"></i>
          </div>
          <div class="copilot-msg-bubble" style="background: white; border: 1px solid var(--color-border); padding: 12px; border-radius: 8px; font-size: 13px; color: var(--color-text); line-height: 1.5;">
            <i class="fa-solid fa-spinner fa-spin" style="color: var(--color-pine); margin-right: 6px;"></i> Lendo documento...
          </div>
        `;
        chatBox.appendChild(aiDiv);
        chatBox.scrollTop = chatBox.scrollHeight;

        // 3. Simula tempo de processamento e responde
        setTimeout(() => {
          const bubble = aiDiv.querySelector(".copilot-msg-bubble");
          
          let analise = "";
          
          if (fileName.toLowerCase().includes('extrato')) {
             analise = `<strong>Documento Lido: ${fileName}</strong><br><br>Detectei lançamentos atípicos no mês de Abril (R$ 15.400,00 recebidos via PIX de contas não identificadas).<br>Recomendo cruzar esses dados com a declaração de faturamento do Simples Nacional ou incluir as notas fiscais de serviço pendentes.`;
          } else if (fileName.toLowerCase().includes('imposto') || fileName.toLowerCase().includes('irpf')) {
             analise = `<strong>Análise de IRPF Concluída!</strong><br><br>As despesas médicas não possuem os recibos vinculados (glosa provável pela Receita). Sugiro que use a funcionalidade de "Checklist" para solicitar os recibos com os respectivos CNPJs/CPFs.`;
          } else {
             analise = `<strong>Análise Documental: ${fileName}</strong><br><br>Li o documento enviado. Os dados parecem regulares e prontos para compor o dossiê. Quer que eu arquive este documento na ficha do cliente e gere o relatório?`;
          }

          bubble.innerHTML = analise;
          chatBox.scrollTop = chatBox.scrollHeight;
        }, 2500);

        // Limpa o input
        this.value = '';
      }
    });
  }
});
