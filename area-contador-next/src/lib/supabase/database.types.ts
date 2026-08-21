export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          client_name: string
          cliente_ref: string | null
          cobranca_id: number | null
          created_at: string | null
          date: string | null
          id: number
          status: string | null
          tax_type: string | null
          time: string | null
        }
        Insert: {
          client_name: string
          cliente_ref?: string | null
          cobranca_id?: number | null
          created_at?: string | null
          date?: string | null
          id?: number
          status?: string | null
          tax_type?: string | null
          time?: string | null
        }
        Update: {
          client_name?: string
          cliente_ref?: string | null
          cobranca_id?: number | null
          created_at?: string | null
          date?: string | null
          id?: number
          status?: string | null
          tax_type?: string | null
          time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      app_erros: {
        Row: {
          codigo: string | null
          contexto: Json
          fingerprint: string
          id: number
          mensagem: string
          ocorrencias: number
          origem: string
          primeiro_em: string
          resolvido_em: string | null
          resolvido_por: string | null
          rota: string | null
          severidade: string
          ultimo_em: string
        }
        Insert: {
          codigo?: string | null
          contexto?: Json
          fingerprint: string
          id?: never
          mensagem: string
          ocorrencias?: number
          origem: string
          primeiro_em?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          rota?: string | null
          severidade?: string
          ultimo_em?: string
        }
        Update: {
          codigo?: string | null
          contexto?: Json
          fingerprint?: string
          id?: never
          mensagem?: string
          ocorrencias?: number
          origem?: string
          primeiro_em?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          rota?: string | null
          severidade?: string
          ultimo_em?: string
        }
        Relationships: []
      }
      assinaturas_historico: {
        Row: {
          asaas_subscription_id: string | null
          cliente_ref: string
          created_at: string
          created_by: string | null
          dia_vencimento: number | null
          id: number
          motivo: string | null
          status: string
          tipo: string | null
          valor_cents: number
        }
        Insert: {
          asaas_subscription_id?: string | null
          cliente_ref: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          id?: never
          motivo?: string | null
          status: string
          tipo?: string | null
          valor_cents: number
        }
        Update: {
          asaas_subscription_id?: string | null
          cliente_ref?: string
          created_at?: string
          created_by?: string | null
          dia_vencimento?: number | null
          id?: never
          motivo?: string | null
          status?: string
          tipo?: string | null
          valor_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_historico_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_express: {
        Row: {
          alerta_sla_em: string | null
          assunto: string | null
          cliente_ref: string
          cobranca_id: number
          concluido_em: string | null
          contratado_em: string
          created_at: string
          id: number
          iniciado_em: string | null
          prazo_conclusao_em: string
          responsavel_id: string | null
          responsavel_nome: string | null
          servico_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alerta_sla_em?: string | null
          assunto?: string | null
          cliente_ref: string
          cobranca_id: number
          concluido_em?: string | null
          contratado_em?: string
          created_at?: string
          id?: number
          iniciado_em?: string | null
          prazo_conclusao_em: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          servico_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alerta_sla_em?: string | null
          assunto?: string | null
          cliente_ref?: string
          cobranca_id?: number
          concluido_em?: string | null
          contratado_em?: string
          created_at?: string
          id?: number
          iniciado_em?: string | null
          prazo_conclusao_em?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          servico_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_express_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_express_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: true
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_express_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      atendimentos_historico: {
        Row: {
          assunto: string | null
          caso_ref: string | null
          cliente_id: string
          cliente_nome: string | null
          created_at: string
          duracao_segundos: number | null
          finalizado_em: string
          honorarios: number | null
          id: number
          iniciado_em: string | null
          modalidade: string | null
          notas: string | null
          relatorio_id: number | null
          tax_type: string | null
        }
        Insert: {
          assunto?: string | null
          caso_ref?: string | null
          cliente_id: string
          cliente_nome?: string | null
          created_at?: string
          duracao_segundos?: number | null
          finalizado_em?: string
          honorarios?: number | null
          id?: never
          iniciado_em?: string | null
          modalidade?: string | null
          notas?: string | null
          relatorio_id?: number | null
          tax_type?: string | null
        }
        Update: {
          assunto?: string | null
          caso_ref?: string | null
          cliente_id?: string
          cliente_nome?: string | null
          created_at?: string
          duracao_segundos?: number | null
          finalizado_em?: string
          honorarios?: number | null
          id?: never
          iniciado_em?: string | null
          modalidade?: string | null
          notas?: string | null
          relatorio_id?: number | null
          tax_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "atendimentos_historico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "atendimentos_historico_relatorio_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          caso_ref: string | null
          cliente_ref: string
          comentario: string | null
          created_at: string
          id: number
          nota: number
          relatorio_id: number | null
        }
        Insert: {
          caso_ref?: string | null
          cliente_ref: string
          comentario?: string | null
          created_at?: string
          id?: never
          nota: number
          relatorio_id?: number | null
        }
        Update: {
          caso_ref?: string | null
          cliente_ref?: string
          comentario?: string | null
          created_at?: string
          id?: never
          nota?: number
          relatorio_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      caixa_postal: {
        Row: {
          assunto: string | null
          cliente_ref: string
          created_at: string
          encerrado_em: string | null
          id: number
          lida: boolean
          mensagem: string
          remetente: string
          status: string
        }
        Insert: {
          assunto?: string | null
          cliente_ref: string
          created_at?: string
          encerrado_em?: string | null
          id?: never
          lida?: boolean
          mensagem: string
          remetente: string
          status?: string
        }
        Update: {
          assunto?: string | null
          cliente_ref?: string
          created_at?: string
          encerrado_em?: string | null
          id?: never
          lida?: boolean
          mensagem?: string
          remetente?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "caixa_postal_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      chaves_sistema: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          auth_tag: string | null
          chave: string
          ciphertext: string | null
          iv: string | null
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          auth_tag?: string | null
          chave: string
          ciphertext?: string | null
          iv?: string | null
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          auth_tag?: string | null
          chave?: string
          ciphertext?: string | null
          iv?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chaves_sistema_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          arquivado_em: string | null
          asaas_subscription_id: string | null
          atendimento_modalidade: string
          avatar: string | null
          bairro: string | null
          caixa_postal_checada_em: string | null
          caixa_postal_novas: boolean | null
          canal_resultado: string
          cep: string | null
          checklist: Json | null
          cidade: string | null
          cpf: string | null
          created_at: string | null
          diagnosis: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          evidences: Json | null
          honorarios: number | null
          id: string
          name: string
          notas: string | null
          numero: string | null
          onboarding_pendente: boolean
          perfil_operacional: Json
          phone: string | null
          recorrente: boolean | null
          recorrente_dia_venc: number | null
          recorrente_tipo: string | null
          regime_detectado_em: string | null
          regime_tributario: string | null
          responsavel_id: string | null
          scheduled_time: string | null
          sem_agendamento_recebido_em: string | null
          sexo: string | null
          status: string | null
          tax_type: string | null
          treatment: string | null
          ultimo_atendimento_finalizado_em: string | null
          user_id: string | null
        }
        Insert: {
          arquivado_em?: string | null
          asaas_subscription_id?: string | null
          atendimento_modalidade?: string
          avatar?: string | null
          bairro?: string | null
          caixa_postal_checada_em?: string | null
          caixa_postal_novas?: boolean | null
          canal_resultado?: string
          cep?: string | null
          checklist?: Json | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          diagnosis?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          evidences?: Json | null
          honorarios?: number | null
          id: string
          name: string
          notas?: string | null
          numero?: string | null
          onboarding_pendente?: boolean
          perfil_operacional?: Json
          phone?: string | null
          recorrente?: boolean | null
          recorrente_dia_venc?: number | null
          recorrente_tipo?: string | null
          regime_detectado_em?: string | null
          regime_tributario?: string | null
          responsavel_id?: string | null
          scheduled_time?: string | null
          sem_agendamento_recebido_em?: string | null
          sexo?: string | null
          status?: string | null
          tax_type?: string | null
          treatment?: string | null
          ultimo_atendimento_finalizado_em?: string | null
          user_id?: string | null
        }
        Update: {
          arquivado_em?: string | null
          asaas_subscription_id?: string | null
          atendimento_modalidade?: string
          avatar?: string | null
          bairro?: string | null
          caixa_postal_checada_em?: string | null
          caixa_postal_novas?: boolean | null
          canal_resultado?: string
          cep?: string | null
          checklist?: Json | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string | null
          diagnosis?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          evidences?: Json | null
          honorarios?: number | null
          id?: string
          name?: string
          notas?: string | null
          numero?: string | null
          onboarding_pendente?: boolean
          perfil_operacional?: Json
          phone?: string | null
          recorrente?: boolean | null
          recorrente_dia_venc?: number | null
          recorrente_tipo?: string | null
          regime_detectado_em?: string | null
          regime_tributario?: string | null
          responsavel_id?: string | null
          scheduled_time?: string | null
          sem_agendamento_recebido_em?: string | null
          sexo?: string | null
          status?: string | null
          tax_type?: string | null
          treatment?: string | null
          ultimo_atendimento_finalizado_em?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          appointment_id: number | null
          appt_date: string | null
          appt_time: string | null
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          billing_type: string | null
          canal_resultado: string
          cliente_ref: string | null
          created_at: string | null
          dados_cliente: Json | null
          desconto_cents: number
          desconto_tipo: string | null
          id: number
          invoice_url: string | null
          modalidade: string
          nota_fiscal_id: string | null
          nota_fiscal_status: string | null
          origem: string
          paid_at: string | null
          pix_image: string | null
          pix_payload: string | null
          poll_token: string | null
          servico_id: string | null
          status: string | null
          valor_cents: number | null
          valor_original_cents: number | null
        }
        Insert: {
          appointment_id?: number | null
          appt_date?: string | null
          appt_time?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          canal_resultado?: string
          cliente_ref?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          desconto_cents?: number
          desconto_tipo?: string | null
          id?: number
          invoice_url?: string | null
          modalidade?: string
          nota_fiscal_id?: string | null
          nota_fiscal_status?: string | null
          origem?: string
          paid_at?: string | null
          pix_image?: string | null
          pix_payload?: string | null
          poll_token?: string | null
          servico_id?: string | null
          status?: string | null
          valor_cents?: number | null
          valor_original_cents?: number | null
        }
        Update: {
          appointment_id?: number | null
          appt_date?: string | null
          appt_time?: string | null
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          billing_type?: string | null
          canal_resultado?: string
          cliente_ref?: string | null
          created_at?: string | null
          dados_cliente?: Json | null
          desconto_cents?: number
          desconto_tipo?: string | null
          id?: number
          invoice_url?: string | null
          modalidade?: string
          nota_fiscal_id?: string | null
          nota_fiscal_status?: string | null
          origem?: string
          paid_at?: string | null
          pix_image?: string | null
          pix_payload?: string | null
          poll_token?: string | null
          servico_id?: string | null
          status?: string | null
          valor_cents?: number | null
          valor_original_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          chave: string
          updated_at: string
          valor: Json
          visivel_cliente: boolean
        }
        Insert: {
          chave: string
          updated_at?: string
          valor: Json
          visivel_cliente?: boolean
        }
        Update: {
          chave?: string
          updated_at?: string
          valor?: Json
          visivel_cliente?: boolean
        }
        Relationships: []
      }
      creditos: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          cliente_ref: string | null
          cobranca_id: number | null
          codigo: string
          created_at: string
          criado_por: string | null
          expira_em: string | null
          id: number
          observacao: string | null
          status: string
          usado_em: string | null
          valor_cents: number
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_ref?: string | null
          cobranca_id?: number | null
          codigo: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: never
          observacao?: string | null
          status?: string
          usado_em?: string | null
          valor_cents: number
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          cliente_ref?: string | null
          cobranca_id?: number | null
          codigo?: string
          created_at?: string
          criado_por?: string | null
          expira_em?: string | null
          id?: never
          observacao?: string | null
          status?: string
          usado_em?: string | null
          valor_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "creditos_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          ai_extracted: Json | null
          checklist_item: string | null
          cliente_ref: string | null
          created_at: string | null
          file_name: string
          id: number
          mime: string | null
          public_url: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          ai_extracted?: Json | null
          checklist_item?: string | null
          cliente_ref?: string | null
          created_at?: string | null
          file_name: string
          id?: number
          mime?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          ai_extracted?: Json | null
          checklist_item?: string | null
          cliente_ref?: string | null
          created_at?: string | null
          file_name?: string
          id?: number
          mime?: string | null
          public_url?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      funil_eventos: {
        Row: {
          cliente_ref: string | null
          cobranca_id: number | null
          created_at: string
          evento: string
          id: number
          metadata: Json
          origem: string | null
          servico_id: string | null
          sessao_ref: string | null
        }
        Insert: {
          cliente_ref?: string | null
          cobranca_id?: number | null
          created_at?: string
          evento: string
          id?: never
          metadata?: Json
          origem?: string | null
          servico_id?: string | null
          sessao_ref?: string | null
        }
        Update: {
          cliente_ref?: string | null
          cobranca_id?: number | null
          created_at?: string
          evento?: string
          id?: never
          metadata?: Json
          origem?: string | null
          servico_id?: string | null
          sessao_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funil_eventos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_eventos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      govbr_credenciais_auditoria: {
        Row: {
          ator_id: string | null
          cliente_id: string
          created_at: string
          detalhes: Json
          evento: string
          id: number
        }
        Insert: {
          ator_id?: string | null
          cliente_id: string
          created_at?: string
          detalhes?: Json
          evento: string
          id?: never
        }
        Update: {
          ator_id?: string | null
          cliente_id?: string
          created_at?: string
          detalhes?: Json
          evento?: string
          id?: never
        }
        Relationships: [
          {
            foreignKeyName: "govbr_credenciais_auditoria_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      govbr_credenciais_cofre: {
        Row: {
          auth_tag: string | null
          ciphertext: string | null
          cliente_id: string
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          iv: string | null
          status: string
          viewed_at: string | null
          viewed_by: string | null
        }
        Insert: {
          auth_tag?: string | null
          ciphertext?: string | null
          cliente_id: string
          created_at?: string
          deleted_at?: string | null
          expires_at: string
          id?: string
          iv?: string | null
          status?: string
          viewed_at?: string | null
          viewed_by?: string | null
        }
        Update: {
          auth_tag?: string | null
          ciphertext?: string | null
          cliente_id?: string
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          iv?: string | null
          status?: string
          viewed_at?: string | null
          viewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "govbr_credenciais_cofre_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      guias_mensais: {
        Row: {
          cliente_ref: string
          competencia: string
          created_at: string
          gerada_em: string | null
          id: number
          observacao: string | null
          status: string
        }
        Insert: {
          cliente_ref: string
          competencia: string
          created_at?: string
          gerada_em?: string | null
          id?: number
          observacao?: string | null
          status?: string
        }
        Update: {
          cliente_ref?: string
          competencia?: string
          created_at?: string
          gerada_em?: string | null
          id?: number
          observacao?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "guias_mensais_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lembretes_enviados: {
        Row: {
          cliente_ref: string | null
          due_date: string | null
          id: number
          obrigacao_id: string | null
          sent_at: string | null
        }
        Insert: {
          cliente_ref?: string | null
          due_date?: string | null
          id?: number
          obrigacao_id?: string | null
          sent_at?: string | null
        }
        Update: {
          cliente_ref?: string | null
          due_date?: string | null
          id?: number
          obrigacao_id?: string | null
          sent_at?: string | null
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          cliente_id: string
          created_at: string | null
          diagnosis: string | null
          doc_name: string | null
          duration: string | null
          id: string
          read_at: string | null
          sender: string
          seq: number
          text: string | null
          time: string | null
          transcricao: string | null
          type: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string | null
          diagnosis?: string | null
          doc_name?: string | null
          duration?: string | null
          id: string
          read_at?: string | null
          sender: string
          seq?: never
          text?: string | null
          time?: string | null
          transcricao?: string | null
          type?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string | null
          diagnosis?: string | null
          doc_name?: string | null
          duration?: string | null
          id?: string
          read_at?: string | null
          sender?: string
          seq?: never
          text?: string | null
          time?: string | null
          transcricao?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          cliente_ref: string | null
          created_at: string | null
          id: number
          text: string
          time: string | null
          unread: boolean | null
        }
        Insert: {
          cliente_ref?: string | null
          created_at?: string | null
          id?: number
          text: string
          time?: string | null
          unread?: boolean | null
        }
        Update: {
          cliente_ref?: string | null
          created_at?: string | null
          id?: number
          text?: string
          time?: string | null
          unread?: boolean | null
        }
        Relationships: []
      }
      obrigacoes: {
        Row: {
          active: boolean | null
          created_at: string | null
          day_of_month: number
          description: string | null
          id: string
          keywords: string[] | null
          month: number | null
          recurrence: string
          reminder_days: number | null
          title: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          day_of_month: number
          description?: string | null
          id: string
          keywords?: string[] | null
          month?: number | null
          recurrence: string
          reminder_days?: number | null
          title: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          day_of_month?: number
          description?: string | null
          id?: string
          keywords?: string[] | null
          month?: number | null
          recurrence?: string
          reminder_days?: number | null
          title?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          chave: string
          criado_em: string
          id: number
        }
        Insert: {
          chave: string
          criado_em?: string
          id?: never
        }
        Update: {
          chave?: string
          criado_em?: string
          id?: never
        }
        Relationships: []
      }
      relatorio_anexos: {
        Row: {
          caso_ref: string | null
          cliente_ref: string
          created_at: string
          created_by: string | null
          descricao: string | null
          documento_id: number | null
          id: number
          referencia: string | null
          relatorio_id: number
          tipo: string
          titulo: string
          url: string | null
          visivel_cliente: boolean
        }
        Insert: {
          caso_ref?: string | null
          cliente_ref: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento_id?: number | null
          id?: never
          referencia?: string | null
          relatorio_id: number
          tipo?: string
          titulo: string
          url?: string | null
          visivel_cliente?: boolean
        }
        Update: {
          caso_ref?: string | null
          cliente_ref?: string
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento_id?: number | null
          id?: never
          referencia?: string | null
          relatorio_id?: number
          tipo?: string
          titulo?: string
          url?: string | null
          visivel_cliente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_anexos_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_anexos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorio_anexos_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      relatorios: {
        Row: {
          agendamento_id: number | null
          atendimento_express_id: number | null
          canais_entrega: Json
          caso_ref: string | null
          cliente_cpf: string | null
          cliente_nome: string | null
          cliente_ref: string
          codigo_validacao: string
          como_feito: string | null
          contador_assinatura: string | null
          contador_crc: string | null
          contador_logo: string | null
          contador_nome: string | null
          created_at: string
          entrega_tentativas: Json
          entregas: string | null
          entregue_em: string | null
          entregue_por: string | null
          falha_entrega: string | null
          formato: string
          id: number
          oque_feito: string | null
          pendencias: string | null
          prazo_proximo_passo: string | null
          problema: string | null
          proximos_passos: Json
          responsavel_proximo_passo: string | null
          revisao_de: number | null
          solucao: string | null
          status: string
          tipo_relatorio: string
          titulo: string | null
          updated_at: string
          versao: number
        }
        Insert: {
          agendamento_id?: number | null
          atendimento_express_id?: number | null
          canais_entrega?: Json
          caso_ref?: string | null
          cliente_cpf?: string | null
          cliente_nome?: string | null
          cliente_ref: string
          codigo_validacao?: string
          como_feito?: string | null
          contador_assinatura?: string | null
          contador_crc?: string | null
          contador_logo?: string | null
          contador_nome?: string | null
          created_at?: string
          entrega_tentativas?: Json
          entregas?: string | null
          entregue_em?: string | null
          entregue_por?: string | null
          falha_entrega?: string | null
          formato?: string
          id?: never
          oque_feito?: string | null
          pendencias?: string | null
          prazo_proximo_passo?: string | null
          problema?: string | null
          proximos_passos?: Json
          responsavel_proximo_passo?: string | null
          revisao_de?: number | null
          solucao?: string | null
          status?: string
          tipo_relatorio?: string
          titulo?: string | null
          updated_at?: string
          versao?: number
        }
        Update: {
          agendamento_id?: number | null
          atendimento_express_id?: number | null
          canais_entrega?: Json
          caso_ref?: string | null
          cliente_cpf?: string | null
          cliente_nome?: string | null
          cliente_ref?: string
          codigo_validacao?: string
          como_feito?: string | null
          contador_assinatura?: string | null
          contador_crc?: string | null
          contador_logo?: string | null
          contador_nome?: string | null
          created_at?: string
          entrega_tentativas?: Json
          entregas?: string | null
          entregue_em?: string | null
          entregue_por?: string | null
          falha_entrega?: string | null
          formato?: string
          id?: never
          oque_feito?: string | null
          pendencias?: string | null
          prazo_proximo_passo?: string | null
          problema?: string | null
          proximos_passos?: Json
          responsavel_proximo_passo?: string | null
          revisao_de?: number | null
          solucao?: string | null
          status?: string
          tipo_relatorio?: string
          titulo?: string | null
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendamento_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_express_fkey"
            columns: ["atendimento_express_id"]
            isOneToOne: false
            referencedRelation: "atendimentos_express"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "relatorios_revisao_de_fkey"
            columns: ["revisao_de"]
            isOneToOne: false
            referencedRelation: "relatorios"
            referencedColumns: ["id"]
          },
        ]
      }
      serpro_consultas: {
        Row: {
          acao: string
          cliente_ref: string | null
          criado_em: string
          disparado_por: string | null
          documento: string
          erro_codigo: string | null
          erro_detalhe: string | null
          id: number
          id_servico: string
          id_sistema: string
          origem: string
          sucesso: boolean
        }
        Insert: {
          acao: string
          cliente_ref?: string | null
          criado_em?: string
          disparado_por?: string | null
          documento: string
          erro_codigo?: string | null
          erro_detalhe?: string | null
          id?: number
          id_servico: string
          id_sistema: string
          origem?: string
          sucesso: boolean
        }
        Update: {
          acao?: string
          cliente_ref?: string | null
          criado_em?: string
          disparado_por?: string | null
          documento?: string
          erro_codigo?: string | null
          erro_detalhe?: string | null
          id?: number
          id_servico?: string
          id_sistema?: string
          origem?: string
          sucesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "serpro_consultas_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      serpro_resultados: {
        Row: {
          cliente_ref: string
          expira_em: string | null
          id: number
          obtido_em: string
          resultado: Json
          servico: string
        }
        Insert: {
          cliente_ref: string
          expira_em?: string | null
          id?: number
          obtido_em?: string
          resultado: Json
          servico: string
        }
        Update: {
          cliente_ref?: string
          expira_em?: string | null
          id?: number
          obtido_em?: string
          resultado?: Json
          servico?: string
        }
        Relationships: [
          {
            foreignKeyName: "serpro_resultados_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      servicos: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          itens: Json
          name: string
          prazo_express_dias_uteis: number
          price_agendado_cents: number | null
          price_cents: number
          recurrence: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id: string
          itens?: Json
          name: string
          prazo_express_dias_uteis?: number
          price_agendado_cents?: number | null
          price_cents: number
          recurrence?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          itens?: Json
          name?: string
          prazo_express_dias_uteis?: number
          price_agendado_cents?: number | null
          price_cents?: number
          recurrence?: string | null
        }
        Relationships: []
      }
      skills_embeddings: {
        Row: {
          chunk_text: string
          created_at: string
          embedding: string | null
          id: string
          skill_name: string
        }
        Insert: {
          chunk_text: string
          created_at?: string
          embedding?: string | null
          id?: string
          skill_name: string
        }
        Update: {
          chunk_text?: string
          created_at?: string
          embedding?: string | null
          id?: string
          skill_name?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          acesso_insights_radar: boolean
          created_at: string | null
          email: string
          fila_restrita: boolean
          id: string | null
          name: string | null
          nome: string | null
          role: string | null
        }
        Insert: {
          acesso_insights_radar?: boolean
          created_at?: string | null
          email: string
          fila_restrita?: boolean
          id?: string | null
          name?: string | null
          nome?: string | null
          role?: string | null
        }
        Update: {
          acesso_insights_radar?: boolean
          created_at?: string | null
          email?: string
          fila_restrita?: boolean
          id?: string | null
          name?: string | null
          nome?: string | null
          role?: string | null
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          caso_ref: string | null
          cliente_ref: string | null
          created_at: string
          criado_por: string | null
          data_final: string | null
          data_inicial: string | null
          excluida: boolean
          feita: boolean
          id: string
          responsavel_id: string | null
          texto: string
          updated_at: string
        }
        Insert: {
          caso_ref?: string | null
          cliente_ref?: string | null
          created_at?: string
          criado_por?: string | null
          data_final?: string | null
          data_inicial?: string | null
          excluida?: boolean
          feita?: boolean
          id?: string
          responsavel_id?: string | null
          texto: string
          updated_at?: string
        }
        Update: {
          caso_ref?: string | null
          cliente_ref?: string | null
          created_at?: string
          criado_por?: string | null
          data_final?: string | null
          data_inicial?: string | null
          excluida?: boolean
          feita?: boolean
          id?: string
          responsavel_id?: string | null
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas_historico: {
        Row: {
          ator_id: string | null
          criado_em: string
          de_responsavel_id: string | null
          evento: string
          id: number
          para_responsavel_id: string | null
          tarefa_id: string
        }
        Insert: {
          ator_id?: string | null
          criado_em?: string
          de_responsavel_id?: string | null
          evento: string
          id?: number
          para_responsavel_id?: string | null
          tarefa_id: string
        }
        Update: {
          ator_id?: string | null
          criado_em?: string
          de_responsavel_id?: string | null
          evento?: string
          id?: number
          para_responsavel_id?: string | null
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_historico_ator_id_fkey"
            columns: ["ator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_historico_de_responsavel_id_fkey"
            columns: ["de_responsavel_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_historico_para_responsavel_id_fkey"
            columns: ["para_responsavel_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_historico_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      triagens: {
        Row: {
          assunto: string | null
          cliente_ref: string
          cobranca_id: number | null
          created_at: string
          descricao: string | null
          enviada_at: string | null
          id: number
          respostas: Json
          status: string
          updated_at: string
        }
        Insert: {
          assunto?: string | null
          cliente_ref: string
          cobranca_id?: number | null
          created_at?: string
          descricao?: string | null
          enviada_at?: string | null
          id?: number
          respostas?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          assunto?: string | null
          cliente_ref?: string
          cobranca_id?: number | null
          created_at?: string
          descricao?: string | null
          enviada_at?: string | null
          id?: number
          respostas?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "triagens_cliente_ref_fkey"
            columns: ["cliente_ref"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triagens_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_eventos: {
        Row: {
          erro: string | null
          evento_id: string
          id: number
          processado_em: string | null
          provedor: string
          recebido_em: string
          recurso_id: string | null
          status: string
          tipo: string | null
        }
        Insert: {
          erro?: string | null
          evento_id: string
          id?: never
          processado_em?: string | null
          provedor: string
          recebido_em?: string
          recurso_id?: string | null
          status?: string
          tipo?: string | null
        }
        Update: {
          erro?: string | null
          evento_id?: string
          id?: never
          processado_em?: string | null
          provedor?: string
          recebido_em?: string
          recurso_id?: string | null
          status?: string
          tipo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      concluir_onboarding_cliente: { Args: never; Returns: undefined }
      confirmar_triagem_atendimento_express: { Args: never; Returns: number }
      finalizar_pos_atendimento: {
        Args: {
          p_canais: Json
          p_entregue_por: string
          p_falhas?: Json
          p_relatorio_id: number
        }
        Returns: Json
      }
      is_staff: { Args: never; Returns: boolean }
      marcar_lidas: { Args: { p_cliente_id: string }; Returns: number }
      match_skills: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
          skill_filter: string
        }
        Returns: {
          chunk_text: string
          id: string
          similarity: number
          skill_name: string
        }[]
      }
      my_client_id: { Args: never; Returns: string }
      my_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
