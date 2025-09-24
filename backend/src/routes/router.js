const Router = require('express').Router;
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');
const usersController = require('../controllers/users-controller');
const rotationplanController = require('../controllers/rotationplan-controler');
const stationsController = require('../controllers/stations-contoller');
const workersController = require('../controllers/workers-controller');

const router = new Router();

//Pages
router.post(
  '/registration',
  body('email').isEmail(),
  body('password').isLength({ min: 6, max: 32 }),
  usersController.registration
);
router.post('/login', usersController.login);
router.post('/logout', usersController.logout);
router.post('/refresh', usersController.refresh);
router.post('/request-reset-password', usersController.requestPasswordReset);
router.post('/reset-password', usersController.resetPassword);

//Services
router.get('/activate/:type/:link', usersController.activate);
router.get('/workers', authMiddleware, workersController.getWorkers);
router.post('/add-worker', authMiddleware, workersController.addWorker);
router.patch(
  '/change-worker-status',
  authMiddleware,
  workersController.workerChangeStatus
);
router.patch(
  '/change-worker-station-status',
  authMiddleware,
  workersController.workerChangeStationStatus
);
router.patch(
  '/change-station-status',
  authMiddleware,
  stationsController.stationChangeStatus
);
router.patch(
  '/worker/:name/station-to-delete',
  authMiddleware,
  workersController.removeStationFromWorker
);
router.patch(
  '/worker/:name/station-to-add',
  authMiddleware,
  workersController.addStationToWorker
);
router.delete('/delete-worker', authMiddleware, workersController.deleteWorker);
router.post(
  '/rotation-preview-excel',
  authMiddleware,
  rotationplanController.previewExcel
);
router.post(
  '/rotation-data',
  authMiddleware,
  rotationplanController.getRotationData
);

router.post(
  '/confirm-rotation',
  authMiddleware,
  rotationplanController.confirmRotation
);
router.get(
  '/download-latest-confirmed-rotation',
  authMiddleware,
  rotationplanController.downloadConfirmedRotation
);
router.get('/stations', authMiddleware, stationsController.getStations);
router.post('/new-station', authMiddleware, stationsController.addStation);
router.delete(
  '/delete-station',
  authMiddleware,
  stationsController.deleteStation
);

module.exports = router;
