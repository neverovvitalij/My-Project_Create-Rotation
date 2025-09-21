module.exports = class UserDto {
  email;
  id;
  isActivated;
  role;
  costCenter;
  shift;
  plant;

  constructor(model) {
    this.email = model?.email;
    this.id = model?._id;
    this.isActivated = model?.isActivated;
    this.role = model?.role;
    this.costCenter = model?.costCenter;
    this.shift = model?.shift;
    this.plant = model?.plant;
  }
};
