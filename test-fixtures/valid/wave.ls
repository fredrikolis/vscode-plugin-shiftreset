/PROG  WAVE
/ATTR
OWNER		= MNEDITOR;
COMMENT		= "REMOTE";
PROG_SIZE	= 722;
CREATE		= DATE 24-06-06  TIME 05:42:48;
MODIFIED	= DATE 24-06-27  TIME 00:09:38;
FILE_NAME	= ;
VERSION		= 0;
LINE_COUNT	= 12;
MEMORY_SIZE	= 1178;
PROTECT		= READ_WRITE;
TCD:  STACK_SIZE	= 0,
      TASK_PRIORITY	= 50,
      TIME_SLICE	= 0,
      BUSY_LAMP_OFF	= 0,
      ABORT_REQUEST	= 0,
      PAUSE_REQUEST	= 0;
DEFAULT_GROUP	= 1,*,*,*,*;
CONTROL_CODE	= 00000000 00000000;
/APPL
/MN
   1:  UFRAME_NUM=3 ;
   2:  UTOOL_NUM=3 ;
   3:  LBL[1] ;
   4:J P[1] 7% CNT50    ;
   5:J P[2] 7% CNT50    ;
   6:J P[3] 7% CNT50    ;
   7:J P[4] 7% CNT50    ;
   8:J P[3] 7% CNT50    ;
   9:J P[2] 7% CNT50    ;
  10:  JMP LBL[1] ;
  11:   ;
  12:   ;
/POS
P[1]{
   GP1:
	UF : 3, UT : 3,		CONFIG : 'F U T, 0, 0, 0',
	X =  -438.431  mm,	Y =  -110.762  mm,	Z =   -43.536  mm,
	W =   130.228 deg,	P =    69.007 deg,	R =   -32.957 deg
};
P[2]{
   GP1:
	UF : 3, UT : 3,		CONFIG : 'F U T, 0, 0, 1',
	X =  -448.958  mm,	Y =  -188.337  mm,	Z =   -51.335  mm,
	W =  -123.858 deg,	P =    65.462 deg,	R =    86.258 deg
};
P[3]{
   GP1:
	UF : 3, UT : 3,		CONFIG : 'F U T, 0, 0, 0',
	X =  -492.154  mm,	Y =   175.019  mm,	Z =   -54.106  mm,
	W =   106.657 deg,	P =    47.337 deg,	R =   -91.954 deg
};
P[4]{
   GP1:
	UF : 3, UT : 3,		CONFIG : 'F U T, 0, 0, 1',
	X =  -477.000  mm,	Y =    88.621  mm,	Z =   -30.130  mm,
	W =  -105.869 deg,	P =    57.370 deg,	R =    70.942 deg
};
/END
