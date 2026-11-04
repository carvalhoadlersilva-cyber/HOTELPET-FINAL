/* ==========================================================================
   formularios.js  -  Semana 3: Edição, Visualização e Configurações
   --------------------------------------------------------------------------
   Liga-se sozinho ao carregar a página. Basta marcar o HTML:

   <form data-colecao="reservas" data-modo="editar|novo">   formulário CRUD
   <form data-config>                                       tela de configurações
   <form data-perfil>                                       edição do perfil do usuário logado
   <section class="painel" data-visao="reservas">           tela "ver" (só leitura)
       <dd data-campo="chegada"></dd>                       preenchido pelo script
       <a data-link="editar_reserva.html">                  vira editar_reserva.html?id=...
   <button data-acao="excluir-registro" data-colecao="pets" data-voltar="index.html">
   <select data-opcoes="clientes|pets">                     opções vindas do localStorage

   Como a tela de edição sabe QUAL registro abrir?
   -> pela URL: editar_reserva.html?id=1234  ->  new URLSearchParams(location.search)

   Carregar com: <script src="js/formularios.js" defer></script>
   ========================================================================== */
const Formularios = (function () {
  'use strict';

  const { esc, data, dataHora, moeda, parseMoeda } = Dados.fmt;
  const { regras } = Dados;

  const idDaUrl = () => new URLSearchParams(location.search).get('id');

  /* ======================================================================
     Utilitários
     ====================================================================== */

  // Lê um arquivo escolhido no <input type="file"> e devolve {nome, url (base64)}
  // Sem backend, guardamos o arquivo dentro do localStorage (limite: 1 MB cada).
  function lerArquivo(arquivo) {
    return new Promise((resolver, rejeitar) => {
      if (arquivo.size > 1000000) {
        rejeitar(new Error(`"${arquivo.name}" é maior que 1 MB.`));
        return;
      }
      const leitor = new FileReader();
      leitor.onload = () => resolver({ nome: arquivo.name, url: leitor.result });
      leitor.onerror = () => rejeitar(new Error(`Falha ao ler "${arquivo.name}".`));
      leitor.readAsDataURL(arquivo);
    });
  }

  // Caixa de mensagem no topo do formulário (erro ou sucesso)
  function mostrarMensagens(form, mensagens, tipo = 'erro') {
    let caixa = form.querySelector('.alerta');
    if (!caixa) {
      caixa = document.createElement('div');
      caixa.setAttribute('role', 'alert');
      form.prepend(caixa);
    }
    caixa.className = tipo === 'sucesso' ? 'alerta alerta-sucesso' : 'alerta';
    caixa.innerHTML = mensagens.map((m) => `<div>${esc(m)}</div>`).join('');
    caixa.hidden = mensagens.length === 0;
    if (mensagens.length) caixa.scrollIntoView({ block: 'nearest' });
  }

  function naoEncontrado(painel, voltar) {
    painel.innerHTML =
      `<h2 class="page-title">Registro não encontrado</h2>
       <p style="margin-left:33px">O registro pedido não existe (talvez tenha sido excluído).</p>
       <div class="rodape-acoes"><a href="${voltar}" class="btn ico-back">Voltar</a></div>`;
  }

  // Preenche os <select data-opcoes="..."> com dados do localStorage
  function popularSelects() {
    document.querySelectorAll('select[data-opcoes]').forEach((select) => {
      let itens = [];
      if (select.dataset.opcoes === 'clientes') {
        itens = Dados.usuarios.listar()
          .filter((u) => u.funcao === 'Cliente')
          .map((u) => [u.id, u.nome + (u.status === 'Inativo' ? ' (inativo)' : '')]);
      }
      if (select.dataset.opcoes === 'pets') {
        itens = Dados.pets.listar().map((p) => {
          const dono = Dados.usuarios.buscar(p.proprietarioId);
          return [p.id, `${p.nome} (${p.tipo})${dono ? ' - ' + dono.nome : ''}`];
        });
      }
      itens.forEach(([valor, texto]) => select.add(new Option(texto, valor)));
    });
  }

  // registro -> campos do formulário (pelo atributo name)
  function preencher(form, valores) {
    Object.entries(valores).forEach(([nome, valor]) => {
      const campo = form.elements[nome];
      if (!campo || campo.type === 'file' || valor === null || valor === undefined) return;
      campo.value = valor;
    });
  }

  // campos do formulário -> objeto simples
  const coletar = (form, nomes) =>
    Object.fromEntries(nomes.map((n) => [n, (form.elements[n]?.value ?? '').trim()]));

  function mostrarNomeDoArquivo(form, campo, idAlvo) {
    const input = form.elements[campo];
    const alvo = document.getElementById(idAlvo);
    if (!input || !alvo) return;
    input.addEventListener('change', () => {
      alvo.textContent = [...input.files].map((f) => f.name).join(', ');
    });
  }

  /* ======================================================================
     ESQUEMAS: regras de cada coleção (validar -> montar o registro)
     ====================================================================== */
  const ESQUEMAS = {
    /* ---------- USUÁRIOS ---------- */
    usuarios: {
      colecao: Dados.usuarios,
      campos: ['nome', 'email', 'funcao', 'status'],
      voltar: 'listagem_usuarios.html',
      paraFormulario: (u) => u,

      validar(d, antigo) {
        const erros = [];
        if (!d.nome) erros.push('Informe o nome.');
        if (!/^\S+@\S+\.\S+$/.test(d.email)) erros.push('Informe um e-mail válido.');
        // Regra do gerente: a função pode ser Gerente, Funcionário ou Cliente
        if (!['Gerente', 'Funcionário', 'Cliente'].includes(d.funcao))
          erros.push('Escolha uma função válida.');
        const repetido = Dados.usuarios.listar().some((u) =>
          u.email.toLowerCase() === d.email.toLowerCase() && (!antigo || u.id !== antigo.id));
        if (repetido) erros.push('Já existe um usuário com este e-mail.');
        if (antigo && regras.ultimoGerenteAtivo(antigo.id) && (d.funcao !== 'Gerente' || d.status !== 'Ativo'))
          erros.push('Este é o último gerente ativo: ele precisa continuar como Gerente e Ativo.');
        return erros;
      },

      // Atenção: a senha digitada em "Novo Usuário" NÃO é guardada (localStorage
      // não é lugar seguro para senhas; num sistema real isso é função do backend).
      async montar(d, antigo) {
        return { ...(antigo || {}), nome: d.nome, email: d.email, funcao: d.funcao, status: d.status || 'Ativo' };
      }
    },

    /* ---------- PETS ---------- */
    pets: {
      colecao: Dados.pets,
      campos: ['proprietarioId', 'nome', 'tipo', 'raca', 'tamanho'],
      voltar: 'index.html',
      paraFormulario: (p) => p,

      validar(d) {
        const erros = [];
        if (!d.proprietarioId) erros.push('Selecione o proprietário.');
        ['nome', 'tipo', 'raca', 'tamanho'].forEach((c) => { if (!d[c]) erros.push(`Preencha o campo ${c}.`); });
        return erros;
      },

      async montar(d, antigo, form) {
        const pet = { ...(antigo || {}), ...d, proprietarioId: Number(d.proprietarioId) };
        const arquivo = form.elements.foto?.files[0];
        if (arquivo) pet.foto = (await lerArquivo(arquivo)).url;
        return pet;
      },

      aoCarregar(form, p) { mostrarPreviaFoto(p.foto); },

      extras(form) {
        form.elements.foto?.addEventListener('change', () => {
          const arquivo = form.elements.foto.files[0];
          if (arquivo) lerArquivo(arquivo).then((a) => mostrarPreviaFoto(a.url)).catch(() => {});
        });
      }
    },

    /* ---------- RESERVAS ---------- */
    reservas: {
      colecao: Dados.reservas,
      campos: ['petId', 'chegada', 'partida', 'notas', 'status', 'anotacoes_funcionarios'],
      voltar: 'listagem_reservas.html',
      paraFormulario: (r) => Dados.view.reserva(r),   // inclui proprietarioNome e petNome

      validar(d, antigo, form) {
        const erros = [];
        const petId = d.petId || antigo?.petId;
        const status = d.status || antigo?.status || 'Reservada';

        if (!petId || !Dados.pets.buscar(petId)) erros.push('Selecione um pet.');

        if (!d.chegada || !d.partida) {
          erros.push('Informe as datas de chegada e partida.');
        } else if (regras.diasEntre(d.chegada, d.partida) <= 0) {
          erros.push('A data de partida deve ser depois da chegada.');
        } else if (!antigo || antigo.chegada !== d.chegada || antigo.partida !== d.partida) {
          // Só confere vagas/conflitos quando o período é novo ou foi alterado
          if (!regras.haVaga(d.chegada, d.partida, antigo?.id))
            erros.push(`Não há vagas no período (limite: ${Dados.config.obter().vagas}).`);
          if (petId && regras.petOcupado(petId, d.chegada, d.partida, antigo?.id))
            erros.push('Este pet já possui uma reserva neste período.');
        }

        if (form.elements.recibo?.files.length && status !== 'Finalizada')
          erros.push('O recibo só pode ser anexado quando o status for "Finalizada".');
        return erros;
      },

      async montar(d, antigo, form) {
        const agora = regras.agora();
        const mudouPeriodo = !antigo || antigo.chegada !== d.chegada || antigo.partida !== d.partida;

        const reserva = {
          ...(antigo || { imagens: [], recibo: null, anotacoes_funcionarios: '', criadoEm: agora }),
          petId: Number(d.petId || antigo.petId),
          chegada: d.chegada,
          partida: d.partida,
          notas: d.notas,
          status: d.status || antigo?.status || 'Reservada',
          atualizadoEm: agora
        };
        // Preço travado: só recalcula se o período mudou (ou se for reserva nova)
        reserva.total = mudouPeriodo ? regras.calcularTotal(d.chegada, d.partida) : antigo.total;

        if (form.elements.anotacoes_funcionarios) reserva.anotacoes_funcionarios = d.anotacoes_funcionarios;

        const imagens = [...(form.elements.imagens?.files || [])];
        for (const arquivo of imagens) reserva.imagens.push(await lerArquivo(arquivo));

        const recibo = form.elements.recibo?.files[0];
        if (recibo) reserva.recibo = await lerArquivo(recibo);
        return reserva;
      },

      aoCarregar(form, r) {
        // Galeria: miniaturas atuais antes do botão "+"
        const galeria = document.getElementById('galeria');
        if (galeria) {
          galeria.querySelectorAll('img.thumb').forEach((i) => i.remove());
          const botaoAdd = galeria.querySelector('.thumb-add');
          (r.imagens || []).forEach((img) => {
            const el = document.createElement('img');
            el.className = 'thumb';
            el.src = img.url;
            el.alt = img.nome;
            galeria.insertBefore(el, botaoAdd);
          });
        }
        // Link do recibo atual
        const link = document.getElementById('link-recibo');
        if (link) {
          link.hidden = !r.recibo;
          if (r.recibo) { link.href = r.recibo.url; link.download = r.recibo.nome; link.textContent = r.recibo.nome; }
        }
      },

      extras(form, antigo) {
        const total = document.getElementById('total-diarias');
        const dica = document.getElementById('dica-diaria');
        const status = form.elements.status;
        const blocoRecibo = document.getElementById('bloco-recibo');

        // Total das diárias em tempo real
        const atualizarTotal = () => {
          if (!total) return;
          const { chegada, partida } = form.elements;
          const dias = regras.diasEntre(chegada.value, partida.value);
          if (dias <= 0) { total.textContent = moeda(0); if (dica) dica.textContent = ''; return; }

          const inalterado = antigo && antigo.chegada === chegada.value && antigo.partida === partida.value;
          total.textContent = moeda(inalterado ? antigo.total : regras.calcularTotal(chegada.value, partida.value));
          if (dica) dica.textContent = inalterado ? '(valor da reserva original)'
            : `(${dias} diária(s) × ${moeda(Dados.config.obter().valorDiaria)})`;
        };

        // Recibo só aparece quando o status é "Finalizada"
        const alternarRecibo = () => { if (blocoRecibo && status) blocoRecibo.hidden = status.value !== 'Finalizada'; };

        ['chegada', 'partida'].forEach((n) => form.elements[n]?.addEventListener('change', atualizarTotal));
        status?.addEventListener('change', alternarRecibo);
        form.addEventListener('reset', () => setTimeout(() => { atualizarTotal(); alternarRecibo(); }, 0));
        mostrarNomeDoArquivo(form, 'imagens', 'imagens-selecionadas');
        mostrarNomeDoArquivo(form, 'recibo', 'recibo-selecionado');

        atualizarTotal();
        alternarRecibo();
      }
    }
  };

  function mostrarPreviaFoto(url) {
    const caixa = document.getElementById('pre-imagem');
    if (caixa && url) caixa.style.background = `url("${url}") center / cover no-repeat`;
  }

  /* ======================================================================
     Formulário CRUD genérico (novo / editar)
     ====================================================================== */
  function ligarFormulario(form) {
    const esquema = ESQUEMAS[form.dataset.colecao];
    if (!esquema) return;

    const painel = form.closest('.painel');
    const editando = form.dataset.modo === 'editar';
    let antigo = null;

    if (editando) {
      antigo = esquema.colecao.buscar(idDaUrl());
      if (!antigo) { naoEncontrado(painel, esquema.voltar); return; }
      preencher(form, esquema.paraFormulario(antigo));   // <- resgata os dados do registro
      esquema.aoCarregar?.(form, antigo);
    }
    esquema.extras?.(form, antigo);

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const dados = coletar(form, esquema.campos);
      const erros = esquema.validar(dados, antigo, form);
      if (erros.length) { mostrarMensagens(form, erros); return; }

      try {
        const registro = await esquema.montar(dados, antigo, form);
        if (!esquema.colecao.salvar(registro)) return;      // erro de storage já alertado
        HotelPet.Navegacao.ir(esquema.voltar);
      } catch (erro) {
        mostrarMensagens(form, [erro.message]);
      }
    });
  }

  /* ======================================================================
     Configurações (valor da diária e vagas)
     ====================================================================== */
  function ligarConfig(form) {
    const el = form.elements;
    const c = Dados.config.obter();

    el.valor_diaria.value = moeda(c.valorDiaria);
    el.limite_vagas.value = c.vagas;
    el.nome_hotel.value = c.nomeHotel;
    el.email_contato.value = c.emailContato;
    el.telefone.value = c.telefone;
    el.notificacoes.value = c.notificacoes;

    form.addEventListener('submit', (evento) => {
      evento.preventDefault();

      const valor = parseMoeda(el.valor_diaria.value);
      const vagas = Number(el.limite_vagas.value);
      const erros = [];

      if (!(valor > 0)) erros.push('Informe um valor de diária maior que zero.');
      if (!Number.isInteger(vagas) || vagas < 1) erros.push('O número de vagas deve ser um inteiro maior que zero.');

      // Não permite reduzir as vagas abaixo do que já está reservado
      const ocupacao = regras.ocupacaoMaximaAtiva();
      if (Number.isInteger(vagas) && vagas < ocupacao)
        erros.push(`Há reservas em aberto que ocupam até ${ocupacao} vaga(s) ao mesmo tempo. Informe ${ocupacao} ou mais.`);

      if (erros.length) { mostrarMensagens(form, erros); return; }

      Dados.config.salvar({
        valorDiaria: valor,
        vagas,
        nomeHotel: el.nome_hotel.value.trim(),
        emailContato: el.email_contato.value.trim(),
        telefone: el.telefone.value.trim(),
        notificacoes: el.notificacoes.value
      });

      el.valor_diaria.value = moeda(valor);   // reformata (ex.: "50" -> "R$ 50,00")
      mostrarMensagens(form, ['Configurações salvas. O novo valor vale para as próximas reservas; as já feitas mantêm o preço original.'], 'sucesso');
    });
  }


  /* ======================================================================
     Perfil do usuário logado (editor_perfil.html)
     ====================================================================== */
  function ligarPerfil(form) {
    const sessao = HotelPet.Sessao.obter();
    const usuario = Dados.usuarios.buscar(sessao?.usuarioId ?? 1);
    if (!usuario) { naoEncontrado(form.closest('.painel'), 'index.html'); return; }

    const el = form.elements;
    const partes = usuario.nome.split(' ');
    const previa = document.getElementById('pre-foto');
    const mostrarFoto = (url) => { if (previa && url) previa.src = url; };

    // Preenche com os dados do cadastro (nome completo -> nome + sobrenome)
    el.email.value = usuario.email;
    el.nome.value = usuario.primeiroNome ?? partes[0];
    el.sobrenome.value = usuario.sobrenome ?? partes.slice(1).join(' ');
    el.telefone.value = usuario.telefone ?? '';
    mostrarFoto(usuario.foto);

    el.foto_perfil.addEventListener('change', () => {
      const arquivo = el.foto_perfil.files[0];
      if (arquivo) lerArquivo(arquivo).then((a) => mostrarFoto(a.url)).catch((e) => mostrarMensagens(form, [e.message]));
    });

    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const d = coletar(form, ['email', 'nome', 'sobrenome', 'telefone']);
      const erros = [];

      if (!d.nome) erros.push('Informe o nome.');
      if (!/^\S+@\S+\.\S+$/.test(d.email)) erros.push('Informe um e-mail válido.');
      if (d.telefone.replace(/\D/g, '').length < 10) erros.push('Informe um telefone com DDD.');
      if (Dados.usuarios.listar().some((u) => u.id !== usuario.id && u.email.toLowerCase() === d.email.toLowerCase()))
        erros.push('Já existe um usuário com este e-mail.');
      if (erros.length) { mostrarMensagens(form, erros); return; }

      try {
        const atualizado = {
          ...usuario,
          primeiroNome: d.nome,
          sobrenome: d.sobrenome,
          nome: `${d.nome} ${d.sobrenome}`.trim(),   // nome completo usado nas listagens
          email: d.email,
          telefone: d.telefone
        };
        const arquivo = el.foto_perfil.files[0];
        if (arquivo) atualizado.foto = (await lerArquivo(arquivo)).url;

        if (!Dados.usuarios.salvar(atualizado)) return;
        HotelPet.Sessao.atualizar({ nome: atualizado.nome });
        HotelPet.Navegacao.preencherCabecalho();          // atualiza nome/foto no topo na hora
        el.foto_perfil.value = '';
        mostrarMensagens(form, ['Perfil atualizado com sucesso.'], 'sucesso');
      } catch (erro) {
        mostrarMensagens(form, [erro.message]);
      }
    });
  }

  /* ======================================================================
     Telas "ver" (somente leitura)
     ====================================================================== */
  const classeStatus = (s) => ({ Finalizada: 'badge-info', Inativo: 'badge-danger' }[s] || 'badge-success');
  const selo = (s) => ({ html: `<span class="badge ${classeStatus(s)}">${esc(s)}</span>` });

  const VISOES = {
    reservas: {
      colecao: Dados.reservas,
      voltar: 'listagem_reservas.html',
      modelo(r) {
        const v = Dados.view.reserva(r);
        const imagens = (r.imagens || []).map((i) =>
          `<img src="${esc(i.url)}" alt="${esc(i.nome)}" class="thumb">`).join('');
        return {
          id: r.id,
          proprietarioNome: v.proprietarioNome,
          pet: { html: `<a href="ver_pet.html?id=${encodeURIComponent(r.petId)}">${esc(v.petNome)}</a>` },
          chegada: data(r.chegada),
          partida: data(r.partida),
          notas: r.notas || '—',
          anotacoes: r.anotacoes_funcionarios || '—',
          imagens: { html: imagens || '—' },
          status: selo(r.status),
          total: moeda(r.total),
          recibo: { html: r.recibo
            ? `<a href="${esc(r.recibo.url)}" download="${esc(r.recibo.nome)}" target="_blank" class="link-anexo ico-clip" style="margin-top:0">${esc(r.recibo.nome)}</a>`
            : '—' },
          criadoEm: dataHora(r.criadoEm),
          atualizadoEm: dataHora(r.atualizadoEm)
        };
      }
    },

    usuarios: {
      colecao: Dados.usuarios,
      voltar: 'listagem_usuarios.html',
      modelo: (u) => ({ id: u.id, nome: u.nome, email: u.email, funcao: u.funcao, status: selo(u.status) })
    },

    pets: {
      colecao: Dados.pets,
      voltar: 'index.html',
      modelo(p) {
        const dono = Dados.usuarios.buscar(p.proprietarioId);
        const rotulo = { Finalizada: 'completa', 'Em progresso': 'em andamento', Reservada: 'reservada' };
        const historico = Dados.reservas.listar()
          .filter((r) => String(r.petId) === String(p.id))
          .map((r) => {
            const classe = r.status === 'Finalizada' ? 'reserva-completa' : 'reserva-andamento';
            return `<li><a href="ver_reserva.html?id=${encodeURIComponent(r.id)}" class="${classe}">` +
                   `${data(r.chegada)} - ${data(r.partida)} (${rotulo[r.status]})</a></li>`;
          }).join('');
        return {
          proprietarioNome: dono ? dono.nome : '—',
          id: p.id, nome: p.nome, tipo: p.tipo, raca: p.raca, tamanho: p.tamanho,
          foto: { html: p.foto ? `<img src="${esc(p.foto)}" alt="Foto do Pet" class="thumb thumb-grande">` : '—' },
          reservas: { html: historico ? `<ul class="lista-reservas">${historico}</ul>` : 'Nenhuma reserva.' }
        };
      }
    }
  };

  function montarVisao(painel) {
    const visao = VISOES[painel.dataset.visao];
    const registro = visao.colecao.buscar(idDaUrl());
    if (!registro) { naoEncontrado(painel, visao.voltar); return; }

    const modelo = visao.modelo(registro);
    painel.querySelectorAll('[data-campo]').forEach((el) => {
      const valor = modelo[el.dataset.campo];
      if (valor !== null && typeof valor === 'object') el.innerHTML = valor.html;   // html já escapado acima
      else el.textContent = valor ?? '';                                           // textContent é seguro
    });
    painel.querySelectorAll('[data-link]').forEach((a) => {
      a.href = `${a.dataset.link}?id=${encodeURIComponent(registro.id)}`;
    });
  }

  // Botão "Deletar" das telas de visualização
  function ligarExclusaoNaVisao() {
    document.addEventListener('click', (evento) => {
      const botao = evento.target.closest('[data-acao="excluir-registro"]');
      if (!botao) return;
      if (!confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return;

      const resultado = Dados.excluir(botao.dataset.colecao, idDaUrl());
      if (!resultado.ok) { alert(resultado.erro || 'Não foi possível excluir.'); return; }
      HotelPet.Navegacao.ir(botao.dataset.voltar);
    });
  }

  /* ======================================================================
     Inicialização automática
     ====================================================================== */
  document.addEventListener('DOMContentLoaded', () => {
    popularSelects();                                   // 1º: opções existem antes de preencher
    document.querySelectorAll('form[data-colecao]').forEach(ligarFormulario);
    document.querySelectorAll('form[data-config]').forEach(ligarConfig);
    document.querySelectorAll('form[data-perfil]').forEach(ligarPerfil);
    document.querySelectorAll('[data-visao]').forEach(montarVisao);
    ligarExclusaoNaVisao();
  });

  return { lerArquivo };
})();
