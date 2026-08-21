import Link from "next/link";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import styles from "../legal.module.css";

export const metadata = {
  title: "Termos de Uso — Olá, Contador",
  description: "Condições de uso da plataforma Olá, Contador: contratação, pagamento, cancelamento, responsabilidades e limites do serviço.",
};

export default function TermosPage() {
  return (
    <>
      <SiteHeader />
      <main className="public-shell">
        <div className={styles.wrap}>
          <h1>Termos de Uso</h1>
          <p className={styles.atualizado}>Última atualização: 3 de agosto de 2026</p>

          <p>
            Estes termos regulam o uso da plataforma <strong>Olá, Contador</strong>, operada pela{" "}
            <strong>HEXX SERVIÇOS DIGITAIS LTDA</strong>, CNPJ nº 62.414.421/0001-16. Ao criar uma conta ou
            contratar um atendimento, você concorda com o que está aqui.
          </p>

          <h2>1. O que é o serviço</h2>
          <p>
            O Olá, Contador é uma plataforma de atendimento contábil on-line. Você pode escolher o{" "}
            <strong>Atendimento Express</strong>, no qual descreve o caso e envia os documentos sem reunião, ou o
            atendimento com horário, realizado pelo chat. Em ambos, um contador habilitado analisa a situação e
            entrega um relatório do que foi tratado.
          </p>
          <p>
            O serviço é <strong>consultivo e contábil</strong>. Não é consultoria jurídica, não substitui advogado e
            não garante resultado específico perante a Receita Federal ou qualquer outro órgão.
          </p>

          <h2>2. Cadastro e conta</h2>
          <ul>
            <li>Você precisa ser maior de 18 anos e fornecer informações verdadeiras e atualizadas.</li>
            <li>O acesso é pessoal. Você é responsável por manter a confidencialidade do seu acesso e por tudo que for feito na sua conta.</li>
            <li>Contas com dados falsos ou usadas para fins ilícitos podem ser suspensas ou encerradas.</li>
          </ul>

          <h2>3. Contratação, preços e pagamento</h2>
          <ul>
            <li>
              Os preços vigentes estão em <Link href="/precos">olacontador.com.br/precos</Link> e são apresentados
              antes da confirmação do pedido.
            </li>
            <li>O pagamento pode ser feito por <strong>Pix</strong>, com desconto, ou por <strong>cartão de crédito</strong>, à vista ou parcelado em até 3 vezes.</li>
            <li>O processamento é feito pelo Asaas. A contratação e, quando aplicável, a reserva do horário só são confirmadas após a confirmação do pagamento.</li>
            <li>O valor combinado é fixo para o escopo contratado. Se o seu caso exigir um trabalho maior, isso será informado e orçado antes de qualquer cobrança adicional.</li>
          </ul>

          <h2>4. Direito de arrependimento</h2>
          <div className={styles.box}>
            <p>
              Por se tratar de contratação fora do estabelecimento comercial, você pode desistir em até{" "}
              <strong>7 dias corridos</strong> contados da contratação, conforme o art. 49 do Código de Defesa do
              Consumidor, com devolução integral do valor pago. Se o atendimento já tiver sido realizado dentro
              desse período, o serviço será considerado prestado. Para exercer o direito, escreva para{" "}
              <a href="mailto:ola@olacontador.com.br">ola@olacontador.com.br</a>.
            </p>
          </div>

          <h2>5. Modalidade, agendamento e remarcação</h2>
          <ul>
            <li>No Atendimento Express, o caso entra na fila de análise depois que a triagem mínima é enviada. Documentos faltantes podem suspender o andamento até a complementação.</li>
            <li>O Atendimento Express dispensa reunião e conversa ao vivo. As etapas ficam disponíveis na área do cliente e o aviso do resultado é enviado por e-mail.</li>
            <li>No atendimento com horário, a conversa acontece no horário agendado pelo chat da plataforma.</li>
            <li>Se você precisar remarcar, avise com antecedência pelas Mensagens da plataforma — faremos o possível para reacomodar você na agenda.</li>
            <li>Se o contador não puder atender no horário marcado, você será avisado e poderá remarcar ou receber o valor de volta.</li>
          </ul>

          <h2>6. Suas responsabilidades</h2>
          <ul>
            <li>Fornecer informações e documentos verdadeiros, completos e legíveis. A qualidade da orientação depende diretamente disso.</li>
            <li>Cumprir prazos e obrigações que forem de sua responsabilidade — pagar guias, entregar declarações, assinar documentos.</li>
            <li>Manter sua conta gov.br ativa, desbloqueada e no nível exigido, quando o serviço contratado depender de acesso a sistemas do governo.</li>
          </ul>

          <h2>7. Radar Fiscal</h2>
          <div className={styles.box}>
            <p>
              <strong>Serviço temporariamente indisponível.</strong> O Radar Fiscal não está sendo comercializado no
              momento. As condições abaixo passam a valer quando ele voltar a ser oferecido.
            </p>
          </div>
          <ul>
            <li>É um serviço de assinatura mensal, cobrado de forma recorrente até que você cancele.</li>
            <li>Verificamos sua Caixa Postal do e-CAC periodicamente e avisamos quando chegar mensagem nova.</li>
            <li>
              O serviço <strong>depende de procuração eletrônica</strong> outorgada por você ao nosso CNPJ no e-CAC.
              Sem ela, ou após a revogação, as consultas não são possíveis.
            </li>
            <li>O cancelamento pode ser pedido a qualquer momento e passa a valer no ciclo seguinte, sem multa.</li>
            <li>O Radar informa o que os sistemas da Receita Federal disponibilizam. Ele não substitui o acompanhamento contábil regular nem garante que nenhuma pendência exista.</li>
          </ul>

          <h2>8. Limites do serviço</h2>
          <p>
            Parte das funções depende de sistemas públicos — Receita Federal, e-CAC, Integra Contador, gov.br.
            Indisponibilidade, lentidão ou mudança de regra nesses sistemas pode impedir ou atrasar uma consulta ou
            emissão, e isso está fora do nosso controle. Quando acontecer, avisaremos e refaremos assim que possível.
          </p>
          <p>Também podemos realizar manutenções programadas na plataforma, com aviso prévio sempre que houver impacto relevante.</p>

          <h2>9. Responsabilidade</h2>
          <ul>
            <li>Respondemos pela adequada prestação do serviço contratado, nos termos do Código de Defesa do Consumidor.</li>
            <li>Não respondemos por prejuízos decorrentes de informações incorretas ou incompletas fornecidas por você, nem por decisões que você tomar contrariando a orientação recebida.</li>
            <li>Não respondemos por multas ou encargos gerados por fatos anteriores à contratação ou por obrigações que sejam da sua responsabilidade e não tenham sido cumpridas.</li>
          </ul>

          <h2>10. Propriedade intelectual</h2>
          <p>
            A plataforma, sua identidade visual e seus conteúdos pertencem à HEXX SERVIÇOS DIGITAIS LTDA. Os
            relatórios emitidos no seu atendimento são seus e você pode usá-los livremente. Seus documentos continuam
            sendo seus — nós apenas os armazenamos para executar o serviço.
          </p>

          <h2>11. Privacidade</h2>
          <p>
            O tratamento dos seus dados pessoais está descrito na nossa{" "}
            <Link href="/privacidade">Política de Privacidade</Link>, que faz parte destes termos.
          </p>

          <h2>12. Alterações</h2>
          <p>
            Podemos alterar estes termos. Mudanças relevantes serão comunicadas pelo e-mail cadastrado ou por aviso
            na plataforma, com antecedência razoável. O uso após a alteração significa concordância com a nova
            versão.
          </p>

          <h2>13. Encerramento</h2>
          <p>
            Você pode encerrar sua conta quando quiser. Podemos encerrar ou suspender contas que descumpram estes
            termos ou a legislação. O encerramento não afeta atendimentos já contratados nem prazos legais de guarda
            de documentos.
          </p>

          <h2>14. Lei aplicável e foro</h2>
          <p>
            Estes termos são regidos pelas leis brasileiras. Fica eleito o foro do domicílio do consumidor para
            dirimir eventuais controvérsias, conforme o Código de Defesa do Consumidor.
          </p>

          <div className={styles.rodape}>
            <p>
              <Link href="/">Início</Link> · <Link href="/precos">Preços</Link> ·{" "}
              <Link href="/privacidade">Política de Privacidade</Link>
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
