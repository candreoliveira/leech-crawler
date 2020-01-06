import { default as mysql } from "mysql";

const connect = async (config) => {
  const connection = mysql.createConnection({
    host: config.host,
    user: config.user,
    password: config.password,
    database: config.name
  });

  connection.connect();
  return connection;
}

export {
  connect
}