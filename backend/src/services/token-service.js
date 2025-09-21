const jwt = require('jsonwebtoken');
const TokenModel = require('../models/token-model');

class TokenService {
  generateToken(payload) {
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: '30m',
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: '30d',
    });
    return { accessToken, refreshToken };
  }

  validateAccessToken(accessToken) {
    try {
      const userData = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
      return userData;
    } catch (error) {
      return null;
    }
  }

  validateRefreshToken(refreshToken) {
    try {
      const userData = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      return userData;
    } catch (error) {
      return null;
    }
  }

  async saveToken(userId, refreshToken) {
    const tokenData = await TokenModel.findOne({ user: userId });
    if (tokenData) {
      tokenData.refreshToken = refreshToken;
      return tokenData.save();
    }
    const token = await TokenModel.create({ user: userId, refreshToken });
    return token;
  }

  async removeToken(refreshToken) {
    const tokenData = await TokenModel.deleteOne({ refreshToken });
    return tokenData;
  }

  async findToken({ userId, refreshToken }) {
    const tokenData = await TokenModel.findOne({ user: userId, refreshToken });
    return tokenData;
  }

  generatePasswordResetToken(payload) {
    const tokenData = jwt.sign(payload, process.env.JWT_RESET_PASSWORD_SECRET, {
      expiresIn: '1h',
    });
    return tokenData;
  }

  validatePasswordResetToken(token) {
    try {
      const userData = jwt.verify(token, process.env.JWT_RESET_PASSWORD_SECRET);
      return userData;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new TokenService();
