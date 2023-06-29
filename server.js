require('dotenv').config()
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;


// Configuração do EJS como mecanismo de visualização
app.set('view engine', 'ejs');

// Middleware para análise de corpos da requisição (parsing)
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração do banco de dados
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

// Configuração da sessão
app.use(session({
  secret: 'abracadabra0800',
  resave: false,
  saveUninitialized: false
}));

// Middleware para verificar se o usuário está autenticado
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    // O usuário está autenticado, continuar para a próxima rota
    next();
  } else {
    // O usuário não está autenticado, redirecionar para a página de login
    res.redirect('/login');
  }
};

// Rota para exibir a página de login
app.get('/login', (req, res) => {
  res.render('login');
});

// Rota para processar o login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Consultar o banco de dados para verificar as credenciais do usuário
  connection.query('SELECT * FROM usuarios WHERE username = ? AND password = ?', [username, password], (error, results) => {
    if (error) throw error;

    if (results.length > 0) {
      // Autenticação bem-sucedida, armazenar o ID do usuário na sessão
      req.session.userId = results[0].id;
      res.redirect('/');
    } else {
      // Autenticação falhou, redirecionar de volta para a página de login com uma mensagem de erro
      res.render('login', { error: 'Credenciais inválidas' });
    }
  });
});

// Rota para exibir a página inicial (protegida)
app.get('/', requireLogin, (req, res) => {
  // Consulta os registros das pessoas em escala no banco de dados
  connection.query('SELECT * FROM pessoas_sobreaviso ORDER BY dataEntrada DESC', (error, results) => {
    if (error) throw error;
    const pessoas = results.map(pessoa => {
      return {
        ...pessoa,
        dataEntrada: formatDate(pessoa.dataEntrada),
        dataSaida: formatDate(pessoa.dataSaida),
        entrada: pessoa.entrada,
        saida: pessoa.saida,
      };
    });
    res.render('index', { pessoas });
  });
});

// Função para formatar a data no formato desejado
function formatDate(date) {
  const options = { day: 'numeric', month: 'long', year: 'numeric' };
  return date.toLocaleDateString('pt-BR', options);
}

// Função para formatar a hora no formato desejado
function formatTime(time) {
  if (time instanceof Date) {
    return time.toLocaleTimeString('pt-BR');
  } else {
    return '';
  }
}

app.get('/visualizar', (req, res) => {

  const dataAtual = new Date();
  const mesAtual = dataAtual.getMonth();
  

  // Consulta os registros do mês atual
  connection.query('SELECT * FROM pessoas_sobreaviso WHERE MONTH(dataEntrada) = ? ORDER BY dataEntrada ASC', mesAtual + 1, (error, results) => {
    if (error) throw error;

    const registrosMesAtual = results.map(pessoa => {
      return {
        ...pessoa,
        dataEntrada: formatDate(pessoa.dataEntrada),
        dataSaida: formatDate(pessoa.dataSaida),
        entrada: pessoa.entrada,
        saida: pessoa.saida,
      };
    });

    // Obtém a data do primeiro dia do próximo mês
    const proximoMes = new Date();
    proximoMes.setMonth(proximoMes.getMonth() + 1);
    proximoMes.setDate(1);

    // Obtém a data do primeiro dia do mês subsequente
    const primeiroDiaMesSubsequente = new Date(proximoMes.getFullYear(), proximoMes.getMonth(), 1);

    // Obtém a data do último dia do mês subsequente
    const ultimoDiaMesSubsequente = new Date(proximoMes.getFullYear(), proximoMes.getMonth() + 1, 0);

    // Consulta os registros do mês subsequente
    connection.query('SELECT * FROM pessoas_sobreaviso WHERE dataEntrada >= ? AND dataEntrada <= ? ORDER BY dataEntrada ASC', [primeiroDiaMesSubsequente, ultimoDiaMesSubsequente], (error, results) => {
      if (error) throw error;

      const registrosMesSubsequente = results.map(pessoa => {
        return {
          ...pessoa,
          dataEntrada: formatDate(pessoa.dataEntrada),
          dataSaida: formatDate(pessoa.dataSaida),
          entrada: pessoa.entrada,
          saida: pessoa.saida,
        };
      });

      const proximosDias = registrosMesAtual.filter(pessoa => {
        const dataEntrada = new Date(pessoa.dataEntrada);
        return dataEntrada > dataAtual;
      });

      res.render('visualizar', { registrosMesAtual, registrosMesSubsequente, proximosDias });
    });
  });
});

// Rota para o cadastro de uma nova pessoa em sobreaviso
app.post('/cadastro', requireLogin, (req, res) => {
  const { nome, cidade, dataEntrada, entrada, dataSaida, saida, tipo } = req.body;

  // Extrair apenas a data (parte antes do 'T') das datas de entrada e saída
  const [dataEntradaDate] = new Date(dataEntrada).toISOString().split('T');
  const [dataSaidaDate] = new Date(dataSaida).toISOString().split('T');

  const novaPessoa = {
    nome,
    cidade,
    dataEntrada: dataEntradaDate,
    entrada: entrada,
    dataSaida: dataSaidaDate,
    saida: saida,
    tipo: tipo,
  };

  // Insere o novo registro no banco de dados
  connection.query('INSERT INTO pessoas_sobreaviso SET ?', novaPessoa, (error, result) => {
    if (error) throw error;
    res.redirect('/');
  });
});


// Rota para a remoção de uma pessoa em sobreaviso
app.get('/remover/:id', requireLogin, (req, res) => {
  const id = req.params.id;

  // Remove o registro do banco de dados
  connection.query('DELETE FROM pessoas_sobreaviso WHERE id = ?', id, (error, result) => {
    if (error) throw error;
    res.redirect('/');
  });
});

// Rota para encerrar a sessão (logout)
app.get('/logout', (req, res) => {
  // Destruir a sessão e redirecionar para a página de login
  req.session.destroy();
  res.redirect('/login');
});

// Inicia o servidor na porta especificada
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
