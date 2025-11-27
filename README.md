# 🛡️ Sistema de Ocorrências CIPA - Canal Anônimo

Sistema completo para registro e acompanhamento de ocorrências de forma anônima e segura, desenvolvido para Comissões Internas de Prevenção de Acidentes (CIPA).

## 📋 Funcionalidades

### 👤 Para Usuários
- ✅ **Registro Anônimo**: Formulário 100% anônimo sem coleta de dados pessoais
- ✅ **Upload de Evidências**: Suporte a imagens, PDF, Word, Excel (até 5MB cada)
- ✅ **Protocolo de Acompanhamento**: Número único para consulta do andamento
- ✅ **Acompanhamento em Tempo Real**: Consulta do status usando o protocolo
- ✅ **Sincronização entre Dispositivos**: Dados sincronizados automaticamente

### 👨‍💼 Para CIPA (Área Administrativa)
- ✅ **Dashboard Completo**: Visualização de todas as ocorrências
- ✅ **Filtros Avançados**: Por tipo, data, local e status
- ✅ **Gestão de Status**: Atualização do andamento das ocorrências
- ✅ **Adição de Observações**: Comentários visíveis no acompanhamento
- ✅ **Exportação CSV**: Download completo dos dados
- ✅ **Estatísticas**: Métricas e insights sobre as ocorrências
- ✅ **Download de Evidências**: Acesso aos arquivos anexados

## 🚀 Como Usar

### 1. Página Inicial (`index.html`)
- **Acesso**: `http://localhost:3000`
- **Funcionalidades**:
  - Visão geral do sistema
  - Botões de acesso rápido
  - Explicação do processo

### 2. Registrar Ocorrência (`registrar.html`)
- **Acesso**: `http://localhost:3000/registrar.html`
- **Passos**:
  1. Selecionar tipo de ocorrência
  2. Informar envolvimento
  3. Preencher dados da ocorrência
  4. Anexar evidências (opcional)
  5. Receber protocolo

### 3. Acompanhar Ocorrência (`acompanhar.html`)
- **Acesso**: `http://localhost:3000/acompanhar.html`
- **Funcionalidades**:
  - Consulta por número de protocolo
  - Visualização do status atual
  - Observações da CIPA

### 4. Área da CIPA
- **Acesso**: Botão "Área da CIPA" em qualquer página
- **Credenciais Padrão**:
  - Usuário: `cipa`
  - Senha: `cipa2024`

## 🛠 Tecnologias Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Armazenamento**: LocalStorage com criptografia AES
- **Sincronização**: BroadcastChannel API + LocalStorage
- **Exportação**: CSV com suporte a acentuação
- **Upload**: File API com validação
- **Design**: CSS Grid + Flexbox + Animações CSS

## 📁 Estrutura do Projeto
