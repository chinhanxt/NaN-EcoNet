import 'dart:async';
import 'package:flutter/material.dart';

/// Countdown timer widget showing remaining slot reservation hold time.
class CountdownTimerWidget extends StatefulWidget {
  final Duration initialDuration;
  final VoidCallback? onExpired;

  const CountdownTimerWidget({
    super.key,
    this.initialDuration = const Duration(minutes: 15),
    this.onExpired,
  });

  @override
  State<CountdownTimerWidget> createState() => _CountdownTimerWidgetState();
}

class _CountdownTimerWidgetState extends State<CountdownTimerWidget> {
  late int _remainingSeconds;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.initialDuration.inSeconds;
    _startTimer();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_remainingSeconds > 0) {
        setState(() {
          _remainingSeconds--;
        });
        if (_remainingSeconds == 0) {
          timer.cancel();
          widget.onExpired?.call();
        }
      } else {
        timer.cancel();
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  String _formatDuration(int totalSeconds) {
    final minutes = totalSeconds ~/ 60;
    final seconds = totalSeconds % 60;
    final mm = minutes.toString().padLeft(2, '0');
    final ss = seconds.toString().padLeft(2, '0');
    return '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final isUrgent = _remainingSeconds < 180; // Under 3 minutes
    // Crimson red when urgent (< 3 min), amber warning when normal
    final color = isUrgent ? const Color(0xFFDC2626) : const Color(0xFFB45309);
    final bgColor = isUrgent ? const Color(0xFFFEF2F2) : const Color(0xFFFFFBEB);
    final borderColor = isUrgent ? const Color(0xFFF87171) : const Color(0xFFFDE68A);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor, width: 1.2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.08),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '⏳ ',
            style: TextStyle(fontSize: 14),
          ),
          Text(
            _formatDuration(_remainingSeconds),
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: color,
              letterSpacing: 0.5,
            ),
          ),
          Text(
            ' còn lại',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
