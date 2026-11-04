/* ==========================================================================
   dados.js  -  Semana 3: Camada de dados + regras de negócio (Visão do Gerente)
   --------------------------------------------------------------------------
   Este arquivo NÃO mexe no DOM. Ele só cuida de:
     1. Guardar/ler dados no localStorage (usuários, pets, reservas, config)
     2. CRUD genérico por coleção (listar, buscar, salvar, remover)
     3. Regras de negócio (cálculo de diárias, vagas, exclusões protegidas)
     4. Formatadores (moeda, datas, escape de HTML)

   Separar "dados" de "tela" é a base do padrão MVC: as telas (tabelas.js e
   formularios.js) só chamam as funções daqui.

   Uso: <script src="js/dados.js"></script> (sem defer) ANTES dos outros.
   Dica de teste: no console, Dados.restaurar() volta tudo ao estado inicial.
   ========================================================================== */
const Dados = (function () {
  'use strict';

  const PREFIXO = 'hotelpet:dados:';

  /* ---------- Dados iniciais (usados só na primeira visita) ---------- */
  const SEED = {
    usuarios: [
      { id: 1, nome: 'João da Silva',  email: 'joao@hotelpet.com',   funcao: 'Gerente',     status: 'Ativo',
        primeiroNome: 'João', sobrenome: 'da Silva', telefone: '(77) 99999-8888', foto: 'perfil_gerente.png' },
      { id: 2, nome: 'Carlos Souza',   email: 'carlos@hotelpet.com', funcao: 'Funcionário', status: 'Ativo' },
      { id: 3, nome: 'Maria Oliveira', email: 'maria@gmail.com',     funcao: 'Cliente',     status: 'Inativo' },
      { id: 4, nome: 'José da Silva',  email: 'jose@gmail.com',      funcao: 'Cliente',     status: 'Ativo' }
    ],
    pets: [
      { id: 1234, proprietarioId: 4, nome: 'Max',    tipo: 'Cachorro', raca: 'Pastor Alemão', tamanho: 'Grande',  foto: 'max.png' },
      { id: 5678, proprietarioId: 3, nome: 'Ginger', tipo: 'Gato',     raca: 'Siamês',        tamanho: 'Pequeno', foto: 'ginger.png' }
    ],
    reservas: [
      {
        id: 1234, petId: 1234, chegada: '2026-08-20', partida: '2026-08-25',
        status: 'Reservada', total: 250,
        notas: 'Alérgico a frango.',
        anotacoes_funcionarios: 'Pet super dócil, passeou diariamente no jardim e comeu bem todas as refeições.',
        imagens: [{ nome: 'image_2.png', url: 'image_2.png' }, { nome: 'estadia2.png', url: 'estadia2.png' }],
        recibo: { nome: 'recibo.pdf', url: 'recibo.pdf' },
        criadoEm: '2026-08-10T14:00', atualizadoEm: '2026-08-25T10:00'
      },
      {
        id: 5678, petId: 5678, chegada: '2026-08-01', partida: '2026-08-05',
        status: 'Finalizada', total: 200,
        notas: '', anotacoes_funcionarios: '', imagens: [], recibo: null,
        criadoEm: '2026-07-28T09:30', atualizadoEm: '2026-08-05T18:00'
      }
    ],
    config: {
      valorDiaria: 50, vagas: 50,
      nomeHotel: 'Hotel Pet', emailContato: 'contato@hotelpet.com',
      telefone: '(77) 99999-8888', notificacoes: 'todas'
    }
  };

  const clonar = (obj) => JSON.parse(JSON.stringify(obj));

  /* ---------- 1. Acesso ao localStorage ---------- */
  function gravar(nome, dados) {
    try {
      localStorage.setItem(PREFIXO + nome, JSON.stringify(dados));
      return true;
    } catch (erro) {
      // Cota estourada (imagens grandes) ou storage bloqueado
      alert('Não foi possível salvar: o armazenamento do navegador está cheio ou bloqueado.');
      return false;
    }
  }

  function ler(nome) {
    let bruto = null;
    try { bruto = localStorage.getItem(PREFIXO + nome); } catch (erro) { /* ignora */ }

    if (bruto === null) {                 // primeira visita: grava o SEED
      const inicial = clonar(SEED[nome]);
      gravar(nome, inicial);
      return inicial;
    }
    try { return JSON.parse(bruto); } catch (erro) { return clonar(SEED[nome]); }
  }

  /* ---------- 2. CRUD genérico de uma coleção (array de objetos com id) ---------- */
  function criarColecao(nome) {
    return {
      listar: () => ler(nome),

      buscar: (id) => ler(nome).find((item) => String(item.id) === String(id)) ?? null,

      // Sem id => cria (id = maior id + 1). Com id => substitui o registro.
      salvar(registro) {
        const lista = ler(nome);
        if (registro.id === undefined || registro.id === null || registro.id === '') {
          registro.id = lista.reduce((maior, i) => Math.max(maior, Number(i.id)), 0) + 1;
          lista.push(registro);
        } else {
          const pos = lista.findIndex((i) => String(i.id) === String(registro.id));
          if (pos >= 0) lista[pos] = registro; else lista.push(registro);
        }
        return gravar(nome, lista) ? registro : null;
      },

      remover(id) {
        const lista = ler(nome).filter((i) => String(i.id) !== String(id));
        return gravar(nome, lista);
      }
    };
  }

  const usuarios = criarColecao('usuarios');
  const pets = criarColecao('pets');
  const reservas = criarColecao('reservas');
  const colecoes = { usuarios, pets, reservas };

  const config = {
    obter: () => ({ ...SEED.config, ...ler('config') }),
    salvar: (parcial) => gravar('config', { ...config.obter(), ...parcial })
  };

  /* ---------- 3. Formatadores ---------- */
  const fmt = {
    // SEMPRE escape dados do usuário antes de colocar em innerHTML
    esc(valor) {
      return String(valor ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    moeda(n) {
      return Number(n || 0)
        .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        .replace(/\u00a0/g, ' ');
    },
    data: (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''),
    dataHora: (iso) => (iso ? `${fmt.data(iso)} ${iso.slice(11, 16)}` : ''),
    // "R$ 1.234,50" -> 1234.5 | "50" -> 50 | inválido -> NaN
    parseMoeda(texto) {
      let s = String(texto).replace(/[^\d.,]/g, '');
      if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return Number.isNaN(n) ? NaN : n;
    }
  };

  /* ---------- 4. Regras de negócio ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const isoLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const CICLOS_STATUS = {
    reservas: ['Reservada', 'Em progresso', 'Finalizada'],
    usuarios: ['Ativo', 'Inativo']
  };

  const regras = {
    agora() {
      const d = new Date();
      return `${isoLocal(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },

    // Nº de diárias = noites entre chegada e partida (20/08 -> 25/08 = 5)
    diasEntre(chegada, partida) {
      if (!chegada || !partida) return 0;
      const ms = new Date(partida + 'T00:00:00') - new Date(chegada + 'T00:00:00');
      return Number.isNaN(ms) ? 0 : Math.round(ms / 86400000);
    },

    calcularTotal(chegada, partida) {
      return Math.max(regras.diasEntre(chegada, partida), 0) * config.obter().valorDiaria;
    },

    // Lista os dias [chegada, partida) -- o dia da partida não ocupa vaga
    diasDoPeriodo(chegada, partida) {
      const dias = [];
      const dia = new Date(chegada + 'T00:00:00');
      const fim = new Date(partida + 'T00:00:00');
      while (dia < fim && dias.length < 400) {
        dias.push(isoLocal(dia));
        dia.setDate(dia.getDate() + 1);
      }
      return dias;
    },

    // Maior nº de pets hospedados AO MESMO TEMPO dentro do período
    ocupacaoMaxima(chegada, partida, ignorarId = null, lista = reservas.listar()) {
      const base = lista.filter((r) => String(r.id) !== String(ignorarId));
      return regras.diasDoPeriodo(chegada, partida).reduce((maior, dia) => {
        const ocupadas = base.filter((r) => r.chegada <= dia && dia < r.partida).length;
        return Math.max(maior, ocupadas);
      }, 0);
    },

    haVaga(chegada, partida, ignorarId = null) {
      return regras.ocupacaoMaxima(chegada, partida, ignorarId) < config.obter().vagas;
    },

    // O mesmo pet não pode ter duas reservas sobrepostas
    petOcupado(petId, chegada, partida, ignorarId = null) {
      return reservas.listar().some((r) =>
        String(r.petId) === String(petId) &&
        String(r.id) !== String(ignorarId) &&
        r.chegada < partida && chegada < r.partida);
    },

    // Maior ocupação das reservas em aberto (usada para validar "vagas" nas configurações)
    ocupacaoMaximaAtiva() {
      const ativas = reservas.listar().filter((r) => r.status !== 'Finalizada');
      if (!ativas.length) return 0;
      const inicio = ativas.map((r) => r.chegada).sort()[0];
      const fim = ativas.map((r) => r.partida).sort().slice(-1)[0];
      return regras.ocupacaoMaxima(inicio, fim, null, ativas);
    },

    // Proteção: o sistema nunca pode ficar sem gerente ativo
    ultimoGerenteAtivo(id) {
      const u = usuarios.buscar(id);
      if (!u || u.funcao !== 'Gerente' || u.status !== 'Ativo') return false;
      return !usuarios.listar().some((x) =>
        String(x.id) !== String(id) && x.funcao === 'Gerente' && x.status === 'Ativo');
    },

    // Retorna um texto de erro ou null (pode excluir)
    validarExclusao(nome, id) {
      if (nome === 'usuarios') {
        if (regras.ultimoGerenteAtivo(id)) return 'Não é possível excluir o último gerente ativo.';
        if (pets.listar().some((p) => String(p.proprietarioId) === String(id)))
          return 'Este usuário possui pets cadastrados. Exclua os pets antes.';
      }
      if (nome === 'pets' && reservas.listar().some((r) => String(r.petId) === String(id)))
        return 'Este pet possui reservas. Exclua as reservas antes.';
      return null;
    },

    proximoStatus(nome, atual) {
      const ciclo = CICLOS_STATUS[nome];
      return ciclo[(ciclo.indexOf(atual) + 1) % ciclo.length];
    }
  };

  /* ---------- 5. Operações compostas (já com as regras aplicadas) ---------- */
  function excluir(nome, id) {
    const erro = regras.validarExclusao(nome, id);
    if (erro) return { ok: false, erro };
    return { ok: colecoes[nome].remover(id) };
  }

  // Gerente pode mudar o status de QUALQUER reserva, inclusive Finalizadas
  function mudarStatus(nome, id) {
    const registro = colecoes[nome].buscar(id);
    if (!registro) return { ok: false, erro: 'Registro não encontrado.' };

    const novo = regras.proximoStatus(nome, registro.status);
    if (nome === 'usuarios' && novo === 'Inativo' && regras.ultimoGerenteAtivo(id))
      return { ok: false, erro: 'Não é possível desativar o último gerente ativo.' };

    registro.status = novo;
    if (nome === 'reservas') registro.atualizadoEm = regras.agora();
    return { ok: Boolean(colecoes[nome].salvar(registro)) };
  }

  /* ---------- 6. "Joins": reserva + pet + proprietário ---------- */
  const view = {
    reserva(r) {
      const pet = pets.buscar(r.petId);
      const dono = pet ? usuarios.buscar(pet.proprietarioId) : null;
      return {
        ...r,
        petNome: pet ? pet.nome : '(pet removido)',
        proprietarioNome: dono ? dono.nome : '—'
      };
    }
  };

  function restaurar() {
    ['usuarios', 'pets', 'reservas', 'config'].forEach((n) => localStorage.removeItem(PREFIXO + n));
  }

  return { usuarios, pets, reservas, config, regras, fmt, view, excluir, mudarStatus, restaurar };
})();
