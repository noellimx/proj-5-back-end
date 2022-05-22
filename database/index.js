import initModels from "./models/index.js";
import crypto from "crypto";
import { systemConfig } from "../config/index.js";
import jwt from "jsonwebtoken";

// HELPERS
const hashPassword = (plain) =>
  crypto
    .createHmac("sha256", systemConfig.DB_PASSWORD_HASH)
    .update(plain)
    .digest("hex");

const JWT_SECRET = crypto.randomBytes(256).toString("base64");

/**
 *
 * @typedef {Object} JWTPayload
 * @property {string} sub identification of user
 */

/**
 *
 * @param {JWTPayload} payload
 * @returns
 */
const newAuthToken = (payload) => {
  console.log(`[newAuthToken]`);

  const token = jwt.sign(payload, JWT_SECRET);

  return token;
};

/**
 *
 * @returns {[boolean,string]} return verification status and subject if verified
 */
const verifyToken = (authToken) => {
  return new Promise((resolve, reject) => {
    jwt.verify(authToken, JWT_SECRET, (err, decoded) => {
      if (err) {
        resolve([false, null, err]);
      } else {
        resolve([true, decoded.sub, null]);
      }
    });
  });
};

// ------

const attachAuthApi = (User) => {
  const createUser = async (username, plainPassword) => {
    const user = await User.create({
      username,
      password: hashPassword(plainPassword),
    });

    return user;
  };

  const getUserByUsername = async (username) =>
    await User.findOne({ where: { username } });

  const getUsernameOfUserId = async (id) => {
    const user = await User.findOne({ where: { id } });

    return user.getDataValue("username");
  };

  const isUserExistingByUsername = async (username) =>
    !!(await getUserByUsername(username));

  const registerUser = async ({ username, plainPassword, password2 }) => {
    const is = await isUserExistingByUsername(username);

    if (is) {
      return [null, "Username taken :("];
    }
    console.log("username taken");

    if (plainPassword !== password2) {
      return [null, "Confirmation password mismatch."];
    }
    if (!username) {
      return [null, "Username must have at least 1 character"];
    }
    if (!plainPassword || !password2) {
      return [null, "Password must have at least 1 character"];
    }

    const user = await createUser(username, plainPassword);

    const id = user.getDataValue("id");
    const createdUsername = user.getDataValue("username");

    console.log(
      `[registerUser] user created { id : ${id} , username: ${createdUsername} }`
    );

    return [id, `Registration Success: #${id} : ${createdUsername} `];
  };

  /**
   * Produce an authorization token recognizable by this server.
   * @param {Object} credentials
   * @returns
   */
  const getAuthToken = async ({ username, password: clearPassword }) => {
    if (!username) {
      return {
        authToken: null,
        msg: "User field should not be empty :(",
      };
    }
    const details = await getUserByUsername(username);
    if (!details) {
      return {
        authToken: null,
        msg: "User not found.",
      };
    }
    const passwordReceivedHashed = hashPassword(clearPassword);
    const passwordDatabaseHashed = details.getDataValue("password");

    const userId = details.getDataValue("id");
    const isMatch = passwordReceivedHashed === passwordDatabaseHashed;

    if (!isMatch) {
      return {
        authToken: null,
        msg: "Credentials mismatch.",
      };
    }

    const authToken = newAuthToken({ sub: userId });
    return { authToken, msg: "ok" };
  };
  const isVerifiedToken = async (authToken) => {
    const [is, sub] = await verifyToken(authToken);

    return is;
  };

  return {
    registerUser,
    getAuthToken,
    isVerifiedToken,
    getUsernameOfUserId,
    verifyToken,
  };
};

const attachedTransactionApi = (User, TrackedTransaction) => {
  const record = async ({ tracker, type, transactionHash }) => {
    console.log(`[Transaction Add Record]`);
    await TrackedTransaction.create({ tracker, type, transactionHash });
  };

  return {
    record,
  };
};

export const initDatabase = (sequelize) => {
  initModels(sequelize);

  const models = sequelize.models;
  const { user, trackedTransaction } = models;

  const auth = attachAuthApi(user);
  const transaction = attachedTransactionApi(user, trackedTransaction);

  const wipe = async () => {
    for await (const model of [trackedTransaction, user]) {
      await model.destroy({ where: {} });
    }
  };

  const seed = async (_ = { isRandom: true }) => {
    // TODO - move to test
    const password = "t";
    await auth.registerUser({
      username: "t",
      plainPassword: password,
      password2: password,
    });
  };

  return {
    sequelize,
    Sequelize: sequelize.Sequelize,
    DataTypes: sequelize.DataTypes,
    models,
    wipe,
    seed,
    api: {
      auth,
      transaction,
    },
  };
};

export default initDatabase;
