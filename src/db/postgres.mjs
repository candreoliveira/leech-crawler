const sync = (model) => {
  return async (params) => {
    return await model.sync(params);
  }
}

const findAllPages = (model, op) => {
  return async (params) => {
    const r = await model.findAll({
      where: {
        name: params.name,
        type: params.type,
        website: params.website,
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      },
      limit: params.limit
    });
    return r.map(i => i.dataValues);
  }
}

const findOnePageByUrl = (model) => {
  return async (url) => {
    const r = await model.findOne({
      where: {
        url: url
      }
    });
    return r.dataValues;
  }
}

const findOneItemByUrl = (model) => {
  return async (url) => {
    const r = await model.findOne({
      where: {
        "data.url": url
      }
    });
    return r.dataValues;
  }
}

const restartPages = (model, op) => {
  return async (params) => {
    return model.update({
      processedAt: params.processedAt,
      startedAt: params.startedAt
    },
      {
        where: {
          website: {
            [op.eq]: params.website
          },
          name: {
            [op.eq]: params.name
          }
        }
      }
    );
  }
}

const countPages = (model, op) => {
  return async (params) => {
    const r = await model.count({
      where: {
        website: {
          [op.eq]: params.website
        },
        name: {
          [op.eq]: params.name
        },
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      }
    });
    return r.dataValues;
  }
}

const countItems = (model, op) => {
  return async (params) => {
    const r = await model.count({
      where: {
        website: {
          [op.eq]: params.website
        },
        name: {
          [op.eq]: params.name
        },
        processedAt: {
          [op.eq]: params.processedAt
        },
        startedAt: {
          [op.eq]: params.startedAt
        }
      }
    });
    return r.dataValues;
  }
}

const upsertItem = (model) => {
  return async (doc) => {
    const r = await model.upsert(doc, {
      returning: true
    });
    return r[0].dataValues;
  }
}

const upsertPage = (model) => {
  return async (doc) => {
    const r = await model.upsert(doc, {
      returning: true
    });
    return r[0].dataValues;
  }
}

export {
  sync,
  findAllPages,
  findOnePageByUrl,
  findOneItemByUrl,
  upsertPage,
  upsertItem,
  countItems,
  countPages,
  restartPages
}