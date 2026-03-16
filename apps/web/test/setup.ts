const vitestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

vitestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
