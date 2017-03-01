class HyperLogLog {
  constructor(size) {
    this.size = size;
    this.bucketCount = 2 ** size;
    this.buckets = new Buffer.allocUnsafe(this.bucketCount).fill(0);
    this.alpha = calculateAlpha(this.bucketCount);
    this.sumOfInverses = this.bucketCount;
    this.countZeroBuckets = this.bucketCount;
  }

  add(hash) {
    if (!hash) {
      return;
    }

    let bucket = hash[0] >>> (32 - this.size);
    let trailingZeros = 1;
  countZeros:
    for (let i = 3; i >= 1; --i) {
      let data = hash[i];
      for (let j = 32; j; --j) {
        if (data & 0x1) {
          break countZeros;
        }

        trailingZeros += 1;
        data = data >>> 1;
      }
    }

    let oldValue = this.buckets[bucket];
    let newValue = Math.max(trailingZeros, oldValue);

    this.sumOfInverses += ((2 ** -newValue) - (2 ** -oldValue));
    if (newValue !== 0 && oldValue === 0) {
      this.countZeroBuckets -= 1;
    }

    this.buckets[bucket] = newValue;

    return this;
  }

  count() {
    let estimate = this.alpha / this.sumOfInverses;

    if (this.countZeroBuckets > 0 && estimate < 5/2 * this.bucketCount) {
      estimate = this.bucketCount * Math.log(this.bucketCount / this.countZeroBuckets);
    }

    return Math.floor(estimate + 0.5);
  }

  relativeError() {
    return 1.04 / Math.sqrt(this.bucketCount);
  }

  merge(data) {
    if (this.size > data.size) {
      let newBucketCount = 2 ** data.size;
      let oldBucketsPerNew = 2 ** (this.size - data.size);
      let newBuckets = new Buffer.allocUnsafe(newBucketCount).fill(0);

      for (let i = 0; i < newBucketCount; ++i) {
        let newBucketValue = data.buckets[i];
        for (let j = 0; j < oldBucketsPerNew; ++j) {
          newBucketValue = Math.max(newBucketValue, this.buckets[i * oldBucketsPerNew + j]);
        }
        newBuckets[i] = newBucketValue;
      }

      this.buckets = newBuckets;
      this.size = data.size;
      this.bucketCount = 2 ** this.size;
      this.alpha = calculateAlpha(this.bucketCount);
    } else {
      let newBucketsPerExisting = 2 ** (data.size - this.size);

      for (let i = data.buckets.length - 1; i >= 0; --i) {
        let existingBucketIndex = (i / newBucketsPerExisting) | 0;
        this.buckets[existingBucketIndex] = Math.max(this.buckets[existingBucketIndex], data.buckets[i]);
      }
    }

    this.sumOfInverses = 0;
    this.countZeroBuckets = 0;

    for (let i = 0; i < this.bucketCount; ++i) {
      let bucket = this.buckets[i];

      if (bucket === 0) {
        this.countZeroBuckets += 1;
      }

      this.sumOfInverses += (2 ** -bucket);
    }
  }
}

function calculateAlpha(bucketCount) {
  return 0.7213 / (1 + 1.079 / bucketCount) * bucketCount * bucketCount;
}

module.exports = exports = HyperLogLog;

module.exports.hash = require('murmurhash3').murmur128Sync;
