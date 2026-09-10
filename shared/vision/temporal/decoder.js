// This adapter estimates engineered collision risk. It is not a Flyvis model.
export class TemporalDecoder {
  constructor(model) {
    if (model?.format !== 'duckfly-temporal-decoder' || model.version !== 1 || model.input !== 1320 || !['temporal', 'static', 'no-pose'].includes(model.mode)) throw Error('Unsupported temporal decoder');
    const widths = [1320, 64, 32, 1];
    if (model.layers?.length !== 3) throw Error('Invalid decoder layers');
    this.layers = model.layers.map((layer, i) => {
      if (layer.weights?.length !== widths[i + 1] || layer.bias?.length !== widths[i + 1] || layer.weights.some(row => row.length !== widths[i] || !row.every(Number.isFinite)) || !layer.bias.every(Number.isFinite)) throw Error('Invalid decoder weights');
      return {weights: layer.weights.map(row => Float64Array.from(row)), bias: Float64Array.from(layer.bias)};
    });
    this.mode = model.mode;
    this.threshold = model.threshold;
  }
  predict(input) {
    if (input?.length !== 1320 || !input.every(Number.isFinite)) throw Error('Invalid temporal input');
    let values = input;
    for (let index = 0; index < this.layers.length; index++) {
      const {weights, bias} = this.layers[index], output = new Float64Array(bias.length);
      for (let i = 0; i < output.length; i++) {
        let value = bias[i];
        for (let j = 0; j < values.length; j++) value += weights[i][j] * values[j];
        output[i] = index < 2 ? Math.max(0, value) : value;
      }
      values = output;
    }
    return 1 / (1 + Math.exp(-values[0]));
  }
}
