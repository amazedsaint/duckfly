% Execute the untouched upstream function from ignored .cache. Only display
% visibility is changed. Its arrays are the independent numerical reference.
here = fileparts(mfilename('fullpath'));
addpath(fullfile(here, '.cache', 'ddmodel', 'models'));
set(0, 'defaultfigurevisible', 'off');
graphics_toolkit('gnuplot');
warning('off', 'all');
groups = {'Fig4L_LocalFlickers', 'Fig4F_SizeTuning'};
for g = 1:numel(groups)
  group = groups{g};
  tic;
  % Octave drops empty trailing CSV fields; MATLAB csvread retains them. The
  % adapter fills only the unused terminal column with literal zero. Array S
  % is compared element-for-element to the original published stimulus.
  a = DDModel2DbyEpoch(fullfile(here, '.cache', 'ddmodel', 'octave-stimuli', group));
  oracle = struct();
  oracle.group = group;
  oracle.octaveVersion = version;
  oracle.elapsedSeconds = toc;
  oracle.centerTraces = [];
  for k = 1:numel(a)
    r = a(k).Rout;
    oracle.centerTraces(k,:) = reshape(r(round(size(r,1)/2),round(size(r,2)/2),:),1,[]);
  end
  oracle.firstEpoch = a(1);
  save('-mat7-binary', fullfile(here, '.cache', [group '-oracle.mat']), 'oracle');
  fprintf('ORACLE_DONE %s %f seconds\n', group, oracle.elapsedSeconds);
  clear a oracle;
  close all;
end
