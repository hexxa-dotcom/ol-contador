import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import styles from "../legal.module.css";

export const metadata = {
  title: "Política de Privacidade — Olá, Contador",
  description: "Como o Olá, Contador coleta, usa, compartilha e protege seus dados pessoais, conforme a Lei Geral de Proteção de Dados (LGPD).",
};

export default function PrivacidadePage() {
  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <div className={styles.wrap}>
          <h1>Política de Privacidade</h1>
          <p className={styles.atualizado}>Última atualização: 6 de agosto de 2026</p>

          <p>
            Esta política explica quais dados pessoais o <strong>Olá, Contador</strong> coleta, por que coleta, com
            quem compartilha e quais são os seus direitos. Ela segue a Lei nº 13.709/2018 — a Lei Geral de Proteção
            de Dados (LGPD).
          </p>

          <h2>1. Quem é o controlador dos seus dados</h2>
          <p>
            O controlador é a <strong>HEXX SERVIÇOS DIGITAIS LTDA</strong>, inscrita no CNPJ sob o nº{" "}
            <strong>62.414.421/0001-16</strong>, responsável pela plataforma Olá, Contador (olacontador.com.br).
          </p>
          <div className={styles.box}>
            <p>
              <strong>Contato para assuntos de privacidade:</strong>
              <br />
              <a href="mailto:ola@olacontador.com.br">ola@olacontador.com.br</a>
            </p>
          </div>

          <h2>2. Quais dados coletamos</h2>

          <h3>Dados que você nos fornece</h3>
          <ul>
            <li><strong>Cadastro:</strong> nome completo, CPF ou CNPJ, e-mail, telefone e, quando informados, endereço, cidade e estado.</li>
            <li><strong>Documentos:</strong> arquivos que você envia para o atendimento — documentos de identificação, comprovantes, recibos, declarações e afins.</li>
            <li><strong>Conteúdo do atendimento:</strong> o que você escreve no pré-atendimento, no chat com o contador e nas mensagens da caixa postal da plataforma.</li>
            <li><strong>Preparação para serviços públicos:</strong> nível declarado da conta gov.br, situação da verificação em duas etapas, dificuldade de acesso e forma preferida de execução.</li>
          </ul>

          <h3>Credencial temporária do gov.br</h3>
          <p>
            Quando o serviço contratado não puder ser executado por procuração eletrônica ou pelo próprio cliente,
            você pode optar por enviar a senha pelo cofre temporário da plataforma. A senha é criptografada e mantida
            separada do seu cadastro, das mensagens, dos documentos e dos relatórios. Ela pode ser revelada uma única
            vez a um integrante autenticado da equipe, expira em no máximo 72 horas e é eliminada após a
            visualização, revogação ou expiração.
          </p>
          <p>
            O cofre não deve ser usado para código temporário de verificação em duas etapas, QR Code, resposta de
            recuperação ou qualquer outro fator adicional. Nunca envie credenciais por chat, e-mail ou WhatsApp.
          </p>

          <h3>Dados gerados pelo uso</h3>
          <ul>
            <li>Registros de acesso e de atividade na plataforma (data, hora e ações realizadas), necessários para segurança e para o histórico do seu atendimento.</li>
            <li>Histórico de agendamentos, pagamentos e relatórios emitidos.</li>
          </ul>

          <h3>Dados obtidos de órgãos públicos</h3>
          <p>
            Quando o seu atendimento exigir, consultamos informações suas junto à Receita Federal por meio do
            Integra Contador (Serpro): mensagens da sua Caixa Postal do e-CAC, relatório de situação fiscal e dados
            de parcelamentos. Essas consultas <strong>só são possíveis se você outorgar uma procuração eletrônica</strong>{" "}
            ao nosso CNPJ no e-CAC, e só acontecem enquanto essa procuração estiver válida. Você pode revogá-la a
            qualquer momento, diretamente no e-CAC. Cada consulta é feita pelo contador responsável pelo seu caso, de
            forma pontual — não há varredura automática dos seus dados sem que você tenha contratado um serviço que
            a preveja.
          </p>

          <h3>Dados de pagamento</h3>
          <p>
            Os pagamentos são processados pelo <strong>Asaas</strong>. Os dados do seu cartão são digitados no
            ambiente do processador e <strong>não são armazenados por nós</strong>. Guardamos apenas o registro da
            cobrança: valor, forma de pagamento, data e situação.
          </p>

          <h2>3. Por que usamos seus dados e com qual base legal</h2>
          <div className={styles.tabelaWrap}>
            <table>
              <tbody>
                <tr><th>Finalidade</th><th>Base legal (LGPD, art. 7º)</th></tr>
                <tr><td>Prestar o serviço contratado: agendar, atender, analisar seu caso e emitir relatórios</td><td>Execução de contrato (inciso V)</td></tr>
                <tr><td>Emitir documentos fiscais e manter registros contábeis obrigatórios</td><td>Cumprimento de obrigação legal ou regulatória (inciso II)</td></tr>
                <tr><td>Consultar sua situação junto à Receita Federal (Radar Fiscal)</td><td>Execução de contrato (inciso V), mediante procuração eletrônica que você outorga</td></tr>
                <tr><td>Executar serviço público que exija acesso direto e para o qual você tenha usado voluntariamente o cofre temporário</td><td>Execução de contrato (inciso V), com autorização específica e possibilidade de revogação antes da abertura</td></tr>
                <tr><td>Enviar avisos operacionais: confirmação, lembrete de horário, aviso de mensagem nova</td><td>Execução de contrato (inciso V)</td></tr>
                <tr><td>Prevenir fraudes e manter a segurança da plataforma</td><td>Legítimo interesse (inciso IX)</td></tr>
              </tbody>
            </table>
          </div>
          <p>Não usamos seus dados para publicidade de terceiros e não vendemos suas informações.</p>

          <h2>4. Uso de inteligência artificial</h2>
          <p>
            A plataforma usa um assistente de IA para apoiar o contador — por exemplo, resumindo o histórico do
            atendimento ou sugerindo um rascunho de resposta. Para isso, <strong>o conteúdo do seu atendimento pode
            ser enviado ao provedor de IA que utilizamos</strong> (Groq). Duas garantias importantes:
          </p>
          <ul>
            <li>A IA <strong>nunca responde a você diretamente</strong>: toda sugestão passa pela revisão do contador antes de ser enviada.</li>
            <li>Nenhuma decisão sobre o seu caso é tomada automaticamente pela IA. A responsabilidade técnica é sempre do profissional.</li>
          </ul>

          <h2>5. Com quem compartilhamos</h2>
          <p>Compartilhamos apenas o necessário, com fornecedores que atuam como operadores dos dados:</p>
          <div className={styles.tabelaWrap}>
            <table>
              <tbody>
                <tr><th>Fornecedor</th><th>Para quê</th></tr>
                <tr><td>Supabase</td><td>Banco de dados e armazenamento dos documentos</td></tr>
                <tr><td>Vercel</td><td>Hospedagem da plataforma</td></tr>
                <tr><td>Asaas</td><td>Processamento de pagamentos</td></tr>
                <tr><td>Resend</td><td>Envio dos e-mails da plataforma</td></tr>
                <tr><td>Groq</td><td>Assistente de IA de apoio ao contador</td></tr>
                <tr><td>Serpro (Integra Contador)</td><td>Consultas à Receita Federal, mediante sua procuração</td></tr>
              </tbody>
            </table>
          </div>
          <p>Também podemos compartilhar dados com autoridades públicas quando houver obrigação legal ou ordem judicial.</p>

          <h2>6. Transferência internacional</h2>
          <p>
            Alguns desses fornecedores mantêm servidores fora do Brasil. Nesses casos, a transferência ocorre com
            base no art. 33 da LGPD, para viabilizar a execução do contrato firmado com você, e exigimos de cada
            fornecedor compromissos contratuais de proteção equivalentes aos previstos na legislação brasileira.
          </p>

          <h2>7. Por quanto tempo guardamos</h2>
          <ul>
            <li><strong>Dados de atendimento, documentos e relatórios:</strong> pelo prazo necessário à prestação do serviço e, depois, pelo prazo em que a legislação fiscal e contábil exige a guarda — em regra, 5 anos.</li>
            <li><strong>Registros de acesso:</strong> 6 meses, conforme o Marco Civil da Internet.</li>
            <li><strong>Dados de cobrança:</strong> pelo prazo exigido pela legislação tributária.</li>
          </ul>
          <p>Encerrado o prazo, os dados são eliminados ou anonimizados.</p>

          <h2>8. Seus direitos</h2>
          <p>A LGPD (art. 18) garante que você possa, a qualquer momento:</p>
          <ul>
            <li>Confirmar se tratamos seus dados e acessá-los;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
            <li>Solicitar a portabilidade dos seus dados;</li>
            <li>Revogar consentimento e ser informado sobre as consequências dessa revogação;</li>
            <li>Saber com quais entidades compartilhamos seus dados;</li>
            <li>Opor-se a um tratamento feito com base em legítimo interesse.</li>
          </ul>
          <p>
            Para exercer qualquer um desses direitos, escreva para{" "}
            <a href="mailto:ola@olacontador.com.br">ola@olacontador.com.br</a>. Responderemos no menor prazo
            possível.
          </p>
          <p>
            Há um limite importante: alguns dados não podem ser apagados a pedido, porque a legislação fiscal e
            contábil obriga a guardá-los por prazo determinado. Nesses casos, explicaremos qual é a obrigação e por
            quanto tempo ela ainda se aplica.
          </p>

          <h2>9. Segurança</h2>
          <p>
            Adotamos medidas técnicas para proteger seus dados: conexão criptografada, controle de acesso por
            autenticação, isolamento por usuário no banco de dados (cada cliente só acessa o próprio cadastro) e
            armazenamento de documentos em área privada, acessível apenas por links temporários. Credenciais enviadas
            ao cofre usam criptografia autenticada, acesso único, prazo máximo de 72 horas, eliminação automática do
            conteúdo cifrado e registro de auditoria sem a senha. Nenhum sistema é 100% imune — se ocorrer um
            incidente relevante, comunicaremos você e a Autoridade Nacional de Proteção de Dados nos termos do art.
            48 da LGPD.
          </p>

          <h2>10. Cookies</h2>
          <p>
            Usamos apenas armazenamento local essencial para manter sua sessão aberta após o login. Não utilizamos
            cookies de publicidade nem rastreamento de terceiros para fins de marketing.
          </p>

          <h2>11. Menores de idade</h2>
          <p>
            A plataforma é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de crianças e
            adolescentes. Se identificarmos um cadastro nessa situação, entraremos em contato com o responsável
            legal.
          </p>

          <h2>12. Alterações desta política</h2>
          <p>
            Podemos atualizar esta política. Quando a mudança for relevante, avisaremos pelo e-mail cadastrado ou por
            um aviso na plataforma. A data no topo indica a versão vigente.
          </p>

          <div className={styles.rodape}>
            <p>
              <Link href="/">Início</Link> · <Link href="/precos">Preços</Link> · <Link href="/termos">Termos de Uso</Link>
              <br />
              © 2026 Olá, Contador · HEXX SERVIÇOS DIGITAIS LTDA · CNPJ 62.414.421/0001-16
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
