;; Benchmark only: reproduce the SDK's linear interpolation and PCM rounding.
;; This is not a filtered resampler and is not a proposed production backend.
(module
  (memory (export "memory") 1)
  (func (export "resample")
    (param $input i32) (param $output i32) (param $inputStart i32)
    (param $total i32) (param $outputStart i32) (param $count i32) (param $ratio f64)
    (local $i i32) (local $left i32) (local $right i32)
    (local $position f64) (local $fraction f64) (local $a f64) (local $b f64) (local $value f64)
    (block $done
      (loop $next
        (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
        (local.set $position (f64.mul
          (f64.convert_i32_u (i32.add (local.get $outputStart) (local.get $i))) (local.get $ratio)))
        (local.set $left (i32.trunc_f64_u (local.get $position)))
        (local.set $right (i32.add (local.get $left) (i32.const 1)))
        (if (i32.ge_u (local.get $right) (local.get $total))
          (then (local.set $right (i32.sub (local.get $total) (i32.const 1)))))
        (local.set $fraction (f64.sub (local.get $position) (f64.convert_i32_u (local.get $left))))
        (local.set $a (f64.div (f64.convert_i32_s (i32.load16_s
          (i32.add (local.get $input) (i32.mul (i32.sub (local.get $left) (local.get $inputStart)) (i32.const 2))))) (f64.const 32768)))
        (local.set $b (f64.div (f64.convert_i32_s (i32.load16_s
          (i32.add (local.get $input) (i32.mul (i32.sub (local.get $right) (local.get $inputStart)) (i32.const 2))))) (f64.const 32768)))
        ;; Float32Array in the SDK rounds the interpolated value before PCM encoding.
        (local.set $value (f64.promote_f32 (f32.demote_f64 (f64.add
          (f64.mul (local.get $a) (f64.sub (f64.const 1) (local.get $fraction)))
          (f64.mul (local.get $b) (local.get $fraction))))))
        (i32.store16 (i32.add (local.get $output) (i32.mul (local.get $i) (i32.const 2)))
          (i32.trunc_f64_s (f64.mul (local.get $value)
            (select (f64.const 32768) (f64.const 32767) (f64.lt (local.get $value) (f64.const 0))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $next)))))
